const supabase = require("../config/supabase");

// Retry logic com backoff exponencial
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Backoff exponencial: 1s, 2s, 4s
      const waitTime = delay * Math.pow(2, i);
      console.log(`[ORDER_SERVICE] Retry ${i + 1}/${maxRetries} em ${waitTime}ms`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Criar pedido com retry
async function createOrder(orderData) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("orders")
      .insert([orderData])
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

// Buscar pedido por ID
async function getOrder(orderId) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) throw error;
    return data;
  });
}

// Atualizar status do pedido
async function updateOrderStatus(orderId, status, additionalData = {}) {
  return withRetry(async () => {
    const updateData = {
      status,
      ...additionalData
    };

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

// Buscar pedidos pending por valor
async function findPendingOrdersByAmount(amount, tolerance = 0.01) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending")
      .gte("total", Number(amount) - tolerance)
      .lte("total", Number(amount) + tolerance)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });
}

// Marcar pedido como pago
async function markOrderAsPaid(orderId, paymentData = {}) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        payment_confirmed_at: new Date().toISOString(),
        ...paymentData
      })
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

// Cancelar pedido
async function cancelOrder(orderId) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        activity_events: supabase.raw(`activity_events || ?::jsonb`, [{
          event: "order_cancelled",
          timestamp: new Date().toISOString(),
          reason: "expired"
        }])
      })
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

// Buscar pedidos expirados
async function findExpiredOrders() {
  return withRetry(async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending")
      .lt("created_at", tenMinutesAgo);

    if (error) throw error;
    return data || [];
  });
}

// Registrar evento
async function logEvent(eventData) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("events")
      .insert([eventData])
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

module.exports = {
  createOrder,
  getOrder,
  updateOrderStatus,
  findPendingOrdersByAmount,
  markOrderAsPaid,
  cancelOrder,
  findExpiredOrders,
  logEvent,
  withRetry
};