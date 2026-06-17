const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/* =========================
   OBTER ORDER POR ORDER_ID
========================= */
router.get("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Order não encontrada" });
    }

    return res.json({
      success: true,
      order: data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================
   TRACKING DE ATIVIDADE
   (RESOLVE O TEU ERRO ATUAL)
========================= */
router.post("/:order_id/activity", async (req, res) => {
  try {
    const { order_id } = req.params;
    const { event } = req.body;

    if (!event) {
      return res.status(400).json({ error: "Evento inválido" });
    }

    // 1. buscar order atual
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    if (fetchError || !order) {
      return res.status(404).json({ error: "Order não encontrada" });
    }

    // 2. aumentar score de atividade
    const newScore = (order.activity_score || 0) + 1;

    const activityEvents = Array.isArray(order.activity_events)
      ? order.activity_events
      : [];

    activityEvents.push({
      event,
      time: new Date().toISOString(),
    });

    // 3. atualizar order
    const { data, error: updateError } = await supabase
      .from("orders")
      .update({
        activity_score: newScore,
        last_activity: event,
        last_activity_at: new Date(),
        activity_events: activityEvents,
      })
      .eq("id", order.id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({
      success: true,
      activity_score: newScore,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;