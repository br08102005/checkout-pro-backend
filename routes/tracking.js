const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAdmin } = require("../middleware/auth");

/* =========================================
   📊 TRACK CHECKOUT VIEW
========================================= */
router.post("/checkout-view", async (req, res) => {
  try {
    const { order_id } = req.body;

    const { data, error } = await supabase
      .from("orders")
      .update({
        checkout_viewed_at: new Date()
      })
      .eq("order_id", order_id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, order: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================================
   📊 TRACK UPSSELL VIEW
========================================= */
router.post("/upsell-view", async (req, res) => {
  try {
    const { order_id } = req.body;

    const { data, error } = await supabase
      .from("orders")
      .update({
        upsell_viewed_at: new Date()
      })
      .eq("order_id", order_id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, order: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================================
   📊 TRACK UPSSELL RESPONSE
========================================= */
router.post("/upsell-response", async (req, res) => {
  try {
    const { order_id, response } = req.body;

    const step =
      response === "accept"
        ? "upsell_accepted"
        : "upsell_rejected";

    const { data, error } = await supabase
      .from("orders")
      .update({
        funnel_step: step,
        upsell_response_at: new Date()
      })
      .eq("order_id", order_id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      success: true,
      order: data
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;