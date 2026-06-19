const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { entregar } = require("../services/deliveryService");
const { executarIntegracoes } = require("../services/integrationService");
const { requireAdmin } = require("../middleware/auth");

/* =========================================
   GET ORDER BY ID (com delivery info)
   ========================================= */
router.get("/orders/:id", async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    // Buscar entregas associadas
    const { data: deliveries } = await supabase
      .from("deliveries")
      .select("*")
      .eq("order_id", orderId)
      .order("delivered_at", { ascending: false });

    // Buscar produto para obter delivery_content
    let deliveryContent = [];
    let deliveryType = "none";

    if (order.product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("delivery_type, delivery_content, checkout_description")
        .eq("id", order.product_id)
        .maybeSingle();

      if (product) {
        deliveryType = product.delivery_type || "none";
        deliveryContent = product.delivery_content || [];

        // Fallback para checkout_description antigo
        if ((!deliveryContent || deliveryContent.length === 0) && product.checkout_description) {
          try {
            const old = JSON.parse(product.checkout_description);
            if (old.delivery_type && old.delivery_value) {
              deliveryContent = [{
                type: old.delivery_type,
                value: old.delivery_value,
                label: "Produto"
              }];
              deliveryType = old.delivery_type;
            }
          } catch (e) {}
        }
      }
    }

    return res.json({
      success: true,
      order: {
        ...order,
        delivery_type: deliveryType,
        delivery_content: deliveryContent,
        deliveries: deliveries || []
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   CONFIRM PAYMENT (admin manual)
   ========================================= */
router.post("/confirm", requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "orderId é obrigatório"
      });
    }

    // Verificar se o pedido existe e está pending
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Pedido já está com status: ${order.status}`
      });
    }

    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        payment_confirmed_at: new Date().toISOString()
      })
      .eq("order_id", orderId)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Registar evento
    await supabase.from("events").insert([{
      event_type: "payment.confirmed",
      product_id: order.product_id,
      order_id: orderId,
      email: order.email,
      metadata: { amount: order.total, confirmed_by: "admin_manual" }
    }]);

    // Entrega automática
    const entregaResult = await entregar(updatedOrder);

    // Executar integrações
    const integracoesResult = await executarIntegracoes(updatedOrder);

    return res.json({
      success: true,
      message: "Pagamento confirmado com sucesso",
      order: updatedOrder,
      delivery: entregaResult.success ? { delivered: true } : { delivered: false, error: entregaResult.error },
      integrations: { executed: integracoesResult.executed || 0 }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
