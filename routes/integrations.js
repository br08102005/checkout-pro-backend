const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/* =========================================
   LISTAR INTEGRAÇÕES DE UM PRODUTO
   ========================================= */
router.get("/:product_id", async (req, res) => {
  try {
    const { product_id } = req.params;

    const { data, error } = await supabase
      .from("product_integrations")
      .select("*")
      .eq("product_id", product_id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      product_id,
      integrations: data || []
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   CRIAR INTEGRAÇÃO PARA UM PRODUTO
   ========================================= */
router.post("/:product_id", async (req, res) => {
  try {
    const { product_id } = req.params;
    const { type, label, config } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, error: "Tipo de integração é obrigatório" });
    }

    if (!config) {
      return res.status(400).json({ success: false, error: "Configuração é obrigatória" });
    }

    // Validar tipos permitidos
    const tiposValidos = [
      "webhook", "meta_pixel", "ga4", "gtm",
      "stripe", "paypal", "custom"
    ];

    if (!tiposValidos.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Tipo inválido. Tipos permitidos: ${tiposValidos.join(", ")}`
      });
    }

    const { data, error } = await supabase
      .from("product_integrations")
      .insert([{
        product_id,
        type,
        label: label || `${type}_${Date.now()}`,
        config,
        active: true
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      message: "Integração criada com sucesso",
      integration: data
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   ACTUALIZAR INTEGRAÇÃO
   ========================================= */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { label, config, active } = req.body;

    const updates = {};
    if (label !== undefined) updates.label = label;
    if (config !== undefined) updates.config = config;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabase
      .from("product_integrations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      message: "Integração actualizada com sucesso",
      integration: data
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   REMOVER INTEGRAÇÃO
   ========================================= */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("product_integrations")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      message: "Integração removida com sucesso"
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   TESTAR INTEGRAÇÃO
   ========================================= */
router.post("/test/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: integracao, error } = await supabase
      .from("product_integrations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !integracao) {
      return res.status(404).json({ success: false, error: "Integração não encontrada" });
    }

    const { executarIntegracao } = require("../services/integrationService");

    // Criar um pedido de teste para a integração
    const testOrder = {
      order_id: "TEST-" + Date.now(),
      product_id: integracao.product_id,
      product_name: "Produto de Teste",
      name: "Teste",
      email: "teste@exemplo.com",
      phone: "900000000",
      total: 1000,
      status: "paid",
      payment_confirmed_at: new Date().toISOString()
    };

    const resultado = await executarIntegracao(integracao, testOrder);

    return res.json({
      success: resultado.success,
      message: resultado.success ? "Integração testada com sucesso" : "Falha no teste",
      result: resultado
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;