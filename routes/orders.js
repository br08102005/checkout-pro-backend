const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/* =========================================
   GET ORDER BY ID
   ========================================= */
router.get("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!order) {
      return res.status(404).json({ error: "Order não encontrada" });
    }

    // Dynamic product integration - get delivery info
    if (order.product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("id", order.product_id)
        .maybeSingle();

      if (product) {
        order.product_name = product.name;
        
        // Parse delivery info from checkout_description
        if (product.checkout_description) {
          try {
            const delivery = JSON.parse(product.checkout_description);
            if (delivery.delivery_type === "pdf") {
              order.pdf_url = delivery.delivery_value;
            } else if (delivery.delivery_type === "link") {
              order.links = [delivery.delivery_value];
            }
          } catch (e) {
            console.error("Error parsing product delivery config:", e);
          }
        }
      }
    }

    return res.json({
      success: true,
      order
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================================
   TRACK ACTIVITY (FUNNEL READY)
   ========================================= */
router.post("/:order_id/activity", async (req, res) => {
  try {
    const { order_id } = req.params;
    const { event } = req.body;

    if (!event) {
      return res.status(400).json({ error: "Evento inválido" });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    if (error || !order) {
      return res.status(404).json({ error: "Order não encontrada" });
    }

    const newScore = Number(order.activity_score || 0) + 1;

    let events = [];

    try {
      events = Array.isArray(order.activity_events)
        ? order.activity_events
        : JSON.parse(order.activity_events || "[]");
    } catch {
      events = [];
    }

    events.push({
      event,
      time: new Date().toISOString()
    });

    let funnel_step = order.funnel_step || "checkout";

    if (event === "checkout_started") {
      funnel_step = "checkout";
    }

    if (event === "upsell_accepted") {
      if (funnel_step === "checkout") funnel_step = "upsell_1";
      else if (funnel_step === "upsell_1") funnel_step = "upsell_2";
      else funnel_step = "success";
    }

    if (event === "upsell_rejected") {
      funnel_step = "downsell";
    }

    if (
      event === "downsell_accepted" ||
      event === "downsell_rejected"
    ) {
      funnel_step = "success";
    }

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        activity_score: newScore,
        last_activity: event,
        last_activity_at: new Date().toISOString(),
        activity_events: events,
        funnel_step
      })
      .eq("order_id", order_id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({
      success: true,
      activity_score: newScore,
      funnel_step
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================================
   UPDATE ORDER STATUS (ADMIN)
   ========================================= */
router.put("/:order_id/status", async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: "Status é obrigatório" });
    }

    const updates = {
      status,
      last_activity_at: new Date().toISOString()
    };

    if (status === "paid") {
      updates.payment_confirmed_at = new Date().toISOString();
    }

    const { data: order, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("order_id", order_id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    return res.json({
      success: true,
      message: `Status do pedido atualizado para ${status}`,
      order
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;