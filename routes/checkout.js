const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAdmin } = require("../middleware/auth");

// Validação de email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
}

// Validação de telefone (9 dígitos)
function isValidPhone(phone) {
  const phoneRegex = /^[0-9]{9}$/;
  return typeof phone === 'string' && phoneRegex.test(phone);
}

/* =========================================
   CREATE ORDER (CHECKOUT)
   ========================================= */
router.post("/create", async (req, res) => {
  try {
    const data = req.body;
    
    // Validar campos obrigatórios
    const requiredFields = ['name', 'email', 'phone', 'product_id'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Campos obrigatórios faltando: ${missingFields.join(', ')}`
      });
    }

    // Validar email
    if (!isValidEmail(data.email)) {
      return res.status(400).json({
        success: false,
        error: "Email inválido"
      });
    }

    // Validar telefone
    if (!isValidPhone(data.phone)) {
      return res.status(400).json({
        success: false,
        error: "Telefone deve conter 9 dígitos"
      });
    }

    // Validar nome
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Nome inválido"
      });
    }

    console.log('[CHECKOUT] Creating order:', {
      name: data.name,
      email: data.email,
      phone: data.phone,
      product_id: data.product_id,
      total: data.total_override
    });

    // Buscar produto para garantir que existe
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", data.product_id)
      .eq("active", true)
      .maybeSingle();

    if (productError || !product) {
      console.error('[CHECKOUT] Product not found:', data.product_id);
      return res.status(404).json({
        success: false,
        error: "Produto não encontrado"
      });
    }

    // Gerar order_id único
    const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const total = data.total_override || product.price;

    // Criar pedido
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          order_id: orderId,
          product_id: product.id,
          product_name: product.name,
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone.trim(),
          total: Number(total),
          status: "pending",
          extras: data.extras || [],
          funnel_step: "checkout",
          activity_score: 1,
          activity_events: [{ event: "order_created", timestamp: new Date().toISOString() }],
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (orderError) {
      console.error('[CHECKOUT] Error creating order:', orderError);
      return res.status(500).json({
        success: false,
        error: "Erro ao criar pedido. Tente novamente."
      });
    }

    console.log('[CHECKOUT] Order created:', orderId);

    // Registrar evento
    await supabase.from("events").insert([{
      event_type: "order.created",
      product_id: product.id,
      order_id: orderId,
      email: data.email,
      metadata: { 
        product_name: product.name,
        total: total,
        has_extras: (data.extras || []).length > 0
      }
    }]).catch(err => console.error('[CHECKOUT] Error logging event:', err));

    // Executar integrações do produto
    try {
      const { data: integrations } = await supabase
        .from("product_integrations")
        .select("*")
        .eq("product_id", product.id)
        .eq("active", true);

      if (integrations && integrations.length > 0) {
        console.log(`[CHECKOUT] Executing ${integrations.length} integrations`);
        // Integrações serão executadas pelo integrationService
      }
    } catch (err) {
      console.error('[CHECKOUT] Error fetching integrations:', err);
    }

    return res.status(201).json({
      success: true,
      order_id: orderId,
      order: order
    });

  } catch (err) {
    console.error('[CHECKOUT] Error in POST /create:', err);
    return res.status(500).json({
      success: false,
      error: "Erro ao criar pedido. Tente novamente."
    });
  }
});

/* =========================================
   GET ORDER BY ID
   ========================================= */
router.get("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error || !order) {
      return res.status(404).json({
        success: false,
        error: "Pedido não encontrado"
      });
    }

    return res.json({
      success: true,
      order
    });
  } catch (err) {
    console.error('[CHECKOUT] Error in GET /:orderId:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;