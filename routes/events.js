const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/* =========================
   TRACK EVENT
========================= */
router.post("/track", async (req, res) => {
  try {
    const {
      event_type,
      product_id = null,
      order_id = null,
      email = null,
      metadata = {}
    } = req.body;

    if (!event_type) {
      return res.status(400).json({ error: "event_type obrigatório" });
    }

    const { data, error } = await supabase
      .from("events")
      .insert([
        {
          event_type,
          product_id,
          order_id,
          email,
          metadata
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, event: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET EVENTS (ADMIN)
========================= */
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, events: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;