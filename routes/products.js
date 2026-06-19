const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAdmin } = require("../middleware/auth");

// =========================================
// SLUG GENERATOR
// =========================================
function generateSlug(name) {
  if (!name || typeof name !== "string") {
    return "produto-" + Date.now();
  }

  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "produto-" + Date.now();
}

/* =========================================
   GET ALL PRODUCTS
========================================= */
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.json({ success: true, products: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   GET PRODUCT BY SLUG (🔥 PUBLIC - CHECKOUT)
========================================= */
router.get("/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: error.message });

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }

    return res.json({
      success: true,
      product: data
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   CREATE PRODUCT
========================================= */
router.post("/create", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      price,
      image,
      description,
      extras = [],
      upsell_product_id,
      downsell_product_id
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Name and price required" });
    }

    const slug = generateSlug(name);

    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          name,
          slug,
          price: Number(price),
          image,
          description,
          extras,
          upsells: upsell_product_id ? [upsell_product_id] : [],
          downsells: downsell_product_id ? [downsell_product_id] : [],
          active: true
        }
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.json({
      success: true,
      product: data,
      checkout_url: `/p/${data.slug}`
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   DELETE PRODUCT
========================================= */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("products")
      .update({ active: false })
      .eq("id", id);

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   GET PRODUCT BY ID (ADMIN ONLY / LEGACY)
   ⚠️ IMPORTANTE: SEMPRE POR ÚLTIMO
========================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return res.status(500).json({ success: false, error: error.message });

    if (!data) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({ success: true, product: data });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;