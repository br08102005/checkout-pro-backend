const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAdmin } = require("../middleware/auth");

/* =========================================
   HISTÓRICO DE NOTIFICAÇÕES MACRODROID
   ========================================= */
router.get("/notifications", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, notifications: data || [] });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   HISTÓRICO DE ENTREGAS
   ========================================= */
router.get("/deliveries", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .order("delivered_at", { ascending: false })
      .limit(500);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, deliveries: data || [] });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   HISTÓRICO DE INTEGRAÇÕES EXECUTADAS
   ========================================= */
router.get("/integration-logs", requireAdmin, async (req, res) => {
  try {
    const { order_id } = req.query;

    let query = supabase
      .from("integration_logs")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(500);

    if (order_id) {
      query = query.eq("order_id", order_id);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, logs: data || [] });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   REENVIAR PRODUTO (admin)
   ========================================= */
router.post("/resend-delivery", requireAdmin, async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, error: "order_id é obrigatório" });
    }

    const { reenviar } = require("../services/deliveryService");

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
        error: "Apenas pedidos pagos podem ter produto reenviado"
      });
    }

    const result = await reenviar(order_id, order.product_id);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: "Produto reenviado com sucesso",
      delivery: result.delivery
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   CONCILIAÇÃO MANUAL (admin)
   - Forçar associação de notificação a pedido
   ========================================= */
router.post("/force-match", requireAdmin, async (req, res) => {
  try {
    const { notification_id, order_id } = req.body;

    if (!notification_id || !order_id) {
      return res.status(400).json({ success: false, error: "notification_id e order_id são obrigatórios" });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ success: false, error: "Pedido não está pendente" });
    }

    // Marcar pedido como pago
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        payment_confirmed_at: new Date().toISOString()
      })
      .eq("order_id", order_id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ success: false, error: updateError.message });
    }

    // Actualizar notificação
    await supabase
      .from("notifications")
      .update({ status: "manual_match", order_id })
      .eq("id", notification_id);

    // Entregar
    const { entregar } = require("../services/deliveryService");
    await entregar(updatedOrder);

    // Executar integrações
    const { executarIntegracoes } = require("../services/integrationService");
    await executarIntegracoes(updatedOrder);

    return res.json({
      success: true,
      message: "Conciliação manual realizada com sucesso",
      order: updatedOrder
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;