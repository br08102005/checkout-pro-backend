const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/* =========================================
   SAFE DATE
========================================= */
const now = () => new Date().toISOString();

/* =========================================
   INIT SAFE ARRAYS
========================================= */
function safeArray(data) {
  return Array.isArray(data) ? data : [];
}

/* =========================================
   📊 TRACK CHECKOUT VIEW
========================================= */
router.post("/checkout-view", async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: "order_id obrigatório"
      });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        checkout_viewed_at: now(),
        last_activity: "checkout_viewed",
        last_activity_at: now()
      })
      .eq("order_id", order_id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      funnel_step: data.funnel_step,
      order: data
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* =========================================
   📊 TRACK UPSELL VIEW
========================================= */
router.post("/upsell-view", async (req, res) => {
  try {
    const { order_id, upsell_index = 1 } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: "order_id obrigatório"
      });
    }

    const step = `upsell_${upsell_index}`;

    const { data, error } = await supabase
      .from("orders")
      .update({
        upsell_viewed_at: now(),
        funnel_step: step,
        last_activity: "upsell_viewed",
        last_activity_at: now()
      })
      .eq("order_id", order_id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      funnel_step: data.funnel_step,
      order: data
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* =========================================
   📊 FUNNEL RESPONSE (CORE ENGINE)
========================================= */
router.post("/funnel-response", async (req, res) => {
  try {
    const {
      order_id,
      step,
      response,
      product_id
    } = req.body;

    if (!order_id || !step || !response) {
      return res.status(400).json({
        success: false,
        error: "Dados insuficientes"
      });
    }

    /* =========================================
       GET ORDER SAFE
    ========================================= */
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        error: "Order não encontrada"
      });
    }

    /* =========================================
       FUNNEL LOGIC
    ========================================= */
    let nextStep = step;
    let status = order.status || "pending";

    if (response === "accept") {
      if (step.startsWith("upsell")) {
        const index = parseInt(step.split("_")[1] || "1");
        nextStep = `upsell_${index + 1}`;
      } else {
        nextStep = "success";
        status = "completed";
      }
    }

    if (response === "reject") {
      if (step.startsWith("upsell")) {
        nextStep = "downsell";
      } else {
        nextStep = "success";
      }
    }

    /* =========================================
       EVENTS LOG (SAFE)
    ========================================= */
    let events = safeArray(order.activity_events);

    events.push({
      event: `funnel_${response}`,
      step,
      product_id: product_id || null,
      time: now()
    });

    /* =========================================
       UPDATE ORDER (FINAL STATE SAFE)
    ========================================= */
    const { data: updated, error } = await supabase
      .from("orders")
      .update({
        funnel_step: nextStep,
        status,
        activity_events: events,
        last_activity: `funnel_${response}`,
        last_activity_at: now(),
        last_product_viewed: product_id || null
      })
      .eq("order_id", order_id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      funnel_step: updated.funnel_step,
      status: updated.status,
      order: updated
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;