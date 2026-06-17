const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAdmin } = require("../middleware/auth");

/* =========================================
   GET FUNNEL BY PRODUCT
========================================= */
router.get("/:product_id", async (req, res) => {
  try {
    const { product_id } = req.params;

    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .maybeSingle();

    if (!product) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    const { data: upsell } = await supabase
      .from("products")
      .select("*")
      .eq("id", product.upsell_product_id || null)
      .maybeSingle();

    const { data: downsell } = await supabase
      .from("products")
      .select("*")
      .eq("id", product.downsell_product_id || null)
      .maybeSingle();

    return res.json({
      success: true,
      funnel: {
        product,
        upsell: upsell || null,
        downsell: downsell || null
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* =========================================
   TRACK FUNNEL CONVERSION
========================================= */
router.post("/track", requireAdmin, async (req, res) => {
  try {
    const { order_id, step } = req.body;

    const { data, error } = await supabase
      .from("orders")
      .update({
        funnel_step: step
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