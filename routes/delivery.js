const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { entregar, reenviar, historico } = require("../services/deliveryService");

/* =========================================
   OBTER HISTÓRICO DE ENTREGAS DE UM PEDIDO
   ========================================= */
router.get("/history/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;

    const result = await historico(order_id);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({ success: true, deliveries: result.deliveries });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   OBTER TODAS AS ENTREGAS (admin)
   ========================================= */
router.get("/all", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .order("delivered_at", { ascending: false })
      .limit(200);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, deliveries: data || [] });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   REENVIAR PRODUTO MANUALMENTE (admin)
   ========================================= */
router.post("/resend", async (req, res) => {
  try {
    const { order_id, product_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, error: "order_id é obrigatório" });
    }

    // Verificar se o pedido está pago
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (order.status !== "paid") {
      return res.status(400).json({
        success: false,
        error: "Apenas pedidos pagos podem ter o produto reenviado"
      });
    }

    const result = await reenviar(order_id, product_id || order.product_id);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: "Produto reenviado com sucesso",
      delivery: result.delivery,
      reenviado: result.reenviado
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;