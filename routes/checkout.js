const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// CRIAR ORDER (VERSÃO SEGURA)
router.post("/create", async (req, res) => {
  try {
    const { product_id, name, email, phone, extras = [] } = req.body;

    console.log("BODY RECEBIDO:", req.body);

    // validação básica
    if (!product_id || !name || !email || !phone) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const cleanId = String(product_id).trim();

    // buscar produto real
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!product) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    // 🔥 TOTAL BASE (SEGURA)
    let total = Number(product.price || 0);

    // 🔥 VALIDAR EXTRAS CONTRA O PRODUTO (IMPORTANTE)
    let safeExtras = [];

    if (Array.isArray(extras)) {
      extras.forEach((e) => {
        const match = (product.extras || []).find(
          (p) => p.name === e.name
        );

        if (match) {
          total += Number(match.price || 0);
          safeExtras.push(match);
        }
      });
    }

    const order_id = "CHK-" + Date.now();

    // criar order
    const { data, error: insertError } = await supabase
      .from("orders")
      .insert([
        {
          order_id,
          product_id: cleanId,
          product_name: product.name,
          name,
          email,
          phone,
          extras: safeExtras,
          total,
          status: "pending",
          created_at: new Date(),
          activity_score: 0
        },
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.json({
      success: true,
      message: "Order criada com sucesso",
      order: data,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;