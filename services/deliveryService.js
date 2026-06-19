const supabase = require("../config/supabase");

// Retry logic com backoff exponencial
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const waitTime = delay * Math.pow(2, i);
      console.log(`[DELIVERY_SERVICE] Retry ${i + 1}/${maxRetries} em ${waitTime}ms`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/* =========================================
   ENTREGAR PRODUTO
   ========================================= */
async function entregar(order) {
  try {
    if (!order || !order.order_id || !order.product_id) {
      return { success: false, error: "Dados insuficientes para entrega" };
    }

    // Verificar se já foi entregue (proteção contra duplicação)
    const { data: existingDeliveries } = await withRetry(() => 
      supabase
        .from("deliveries")
        .select("*")
        .eq("order_id", order.order_id)
    );

    if (existingDeliveries && existingDeliveries.length > 0) {
      return { success: false, error: "Produto já entregue para este pedido", alreadyDelivered: true };
    }

    // Obter produto com informações de entrega
    const { data: product } = await withRetry(() => 
      supabase
        .from("products")
        .select("*")
        .eq("id", order.product_id)
        .maybeSingle()
    );

    if (!product) {
      return { success: false, error: "Produto não encontrado" };
    }

    // Determinar tipo de entrega e conteúdo
    const deliveryType = product.delivery_type || "none";
    let deliveryContent = product.delivery_content || [];

    // Fallback para checkout_description antigo
    if (!deliveryContent || deliveryContent.length === 0) {
      if (product.checkout_description) {
        try {
          const oldDelivery = JSON.parse(product.checkout_description);
          if (oldDelivery.delivery_type && oldDelivery.delivery_value) {
            deliveryContent = [{
              type: oldDelivery.delivery_type,
              value: oldDelivery.delivery_value,
              label: "Produto"
            }];
          }
        } catch (e) {
          // ignorar
        }
      }
    }

    // Guardar registo de entrega
    const { data: delivery, error } = await supabase
      .from("deliveries")
      .insert([{
        order_id: order.order_id,
        product_id: String(order.product_id),
        delivery_type: deliveryType,
        delivery_content: deliveryContent,
        delivered_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      delivery,
      deliveryType,
      deliveryContent
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/* =========================================
   REENVIAR PRODUTO (admin)
   ========================================= */
async function reenviar(orderId, productId) {
  try {
    // Obter entregas existentes
    const { data: existingDeliveries } = await supabase
      .from("deliveries")
      .select("*")
      .eq("order_id", orderId);

    if (!existingDeliveries || existingDeliveries.length === 0) {
      // Se não existe entrega, criar uma nova
      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      if (!order) {
        return { success: false, error: "Pedido não encontrado" };
      }

      return await entregar(order);
    }

    // Marcar como reenviado
    const { data: delivery, error } = await supabase
      .from("deliveries")
      .update({
        resent: true,
        resent_at: new Date().toISOString()
      })
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      delivery,
      reenviado: true
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/* =========================================
   OBTER HISTÓRICO DE ENTREGAS
   ========================================= */
async function historico(orderId) {
  try {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("order_id", orderId)
      .order("delivered_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, deliveries: data || [] };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  entregar,
  reenviar,
  historico
};