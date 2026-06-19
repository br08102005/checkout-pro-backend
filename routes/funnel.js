const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/* =========================================
   GET FULL FUNNEL (DIRECT PRODUCTS QUERY)
   ========================================= */
router.get("/:product_id", async (req, res) => {
  try {
    const { product_id } = req.params;

    /* =========================
       GET PRODUCT
       ========================= */
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .maybeSingle();

    if (productError || !product) {
      return res.status(404).json({
        success: false,
        error: "Produto não encontrado"
      });
    }

    /* =========================
       UPSELLS (FROM PRODUCTS)
       ========================= */
    let upsells = [];
    const productUpsellIds = Array.isArray(product.upsells) ? product.upsells : [];

    if (productUpsellIds.length > 0) {
      const { data: upsellData } = await supabase
        .from("products")
        .select("*")
        .in("id", productUpsellIds);

      if (upsellData) {
        upsells = productUpsellIds
          .map(id => upsellData.find(p => String(p.id) === String(id)))
          .filter(Boolean);
      }
    }

    /* =========================
       DOWNSELLS (FROM PRODUCTS)
       ========================= */
    let downsells = [];
    const productDownsellIds = Array.isArray(product.downsells) ? product.downsells : [];

    if (productDownsellIds.length > 0) {
      const { data: downsellData } = await supabase
        .from("products")
        .select("*")
        .in("id", productDownsellIds);

      if (downsellData) {
        downsells = productDownsellIds
          .map(id => downsellData.find(p => String(p.id) === String(id)))
          .filter(Boolean);
      }
    }

    /* =========================
       RESPONSE FINAL
       ========================= */
    return res.json({
      success: true,

      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        image: product.image,
        description: product.description || "",
        extras: product.extras || []
      },

      order_bump: null,

      upsells,
      downsells,
      
      upsell: upsells.length > 0 ? upsells[0] : null,
      downsell: downsells.length > 0 ? downsells[0] : null
    });

  } catch (err) {
    console.error("FUNNEL ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;