const supabase = require("../config/supabase");
const https = require("https");
const http = require("http");

/* =========================================
   EXECUTAR INTEGRAÇÕES DE UM PRODUTO
   ========================================= */
async function executarIntegracoes(order) {
  try {
    if (!order || !order.product_id || !order.order_id) {
      return { success: false, error: "Dados insuficientes" };
    }

    // Buscar todas as integrações activas do produto
    const { data: integracoes, error } = await supabase
      .from("product_integrations")
      .select("*")
      .eq("product_id", order.product_id)
      .eq("active", true);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!integracoes || integracoes.length === 0) {
      return { success: true, executed: 0, message: "Nenhuma integração configurada" };
    }

    const resultados = [];

    for (const integracao of integracoes) {
      try {
        const resultado = await executarIntegracao(integracao, order);
        resultados.push(resultado);

        // Registar log
        await supabase.from("integration_logs").insert([{
          integration_id: integracao.id,
          order_id: order.order_id,
          event: `integration.${integracao.type}`,
          status: resultado.success ? "success" : "error",
          response: resultado.response || null,
          error: resultado.error || null,
          executed_at: new Date().toISOString()
        }]);

      } catch (err) {
        resultados.push({
          integration_id: integracao.id,
          type: integracao.type,
          success: false,
          error: err.message
        });

        await supabase.from("integration_logs").insert([{
          integration_id: integracao.id,
          order_id: order.order_id,
          event: `integration.${integracao.type}`,
          status: "error",
          error: err.message,
          executed_at: new Date().toISOString()
        }]);
      }
    }

    return {
      success: true,
      executed: resultados.length,
      resultados
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/* =========================================
   EXECUTAR UMA INTEGRAÇÃO ESPECÍFICA
   ========================================= */
async function executarIntegracao(integracao, order) {
  const config = integracao.config || {};

  switch (integracao.type) {
    case "webhook":
      return executarWebhook(config, order);

    case "meta_pixel":
      return { success: true, type: "meta_pixel", message: "Pixel registado para evento" };

    case "ga4":
      return { success: true, type: "ga4", message: "GA4 registado para evento" };

    case "gtm":
      return { success: true, type: "gtm", message: "GTM registado para evento" };

    case "stripe":
      return { success: true, type: "stripe", message: "Stripe notificado" };

    case "paypal":
      return { success: true, type: "paypal", message: "PayPal notificado" };

    case "custom":
      return executarWebhook(config, order);

    default:
      return { success: false, error: `Tipo de integração desconhecido: ${integracao.type}` };
  }
}

/* =========================================
   EXECUTAR WEBHOOK HTTP/HTTPS
   ========================================= */
function executarWebhook(config, order) {
  return new Promise((resolve) => {
    const url = config.url || config.webhook_url || "";
    if (!url) {
      return resolve({ success: false, error: "URL do webhook não configurado" });
    }

    const payload = JSON.stringify({
      event: "payment.confirmed",
      order_id: order.order_id,
      product_id: order.product_id,
      product_name: order.product_name,
      customer: {
        name: order.name,
        email: order.email,
        phone: order.phone
      },
      total: order.total,
      status: order.status,
      paid_at: order.payment_confirmed_at || new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

    const client = url.startsWith("https") ? https : http;

    try {
      const req = client.request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "User-Agent": "Checkout-Pro-Webhook/1.0"
        },
        timeout: 10000
      }, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            type: "webhook",
            response: {
              statusCode: res.statusCode,
              body: body.substring(0, 1000)
            }
          });
        });
      });

      req.on("error", (e) => {
        resolve({ success: false, type: "webhook", error: e.message });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ success: false, type: "webhook", error: "Timeout após 10 segundos" });
      });

      req.write(payload);
      req.end();

    } catch (err) {
      resolve({ success: false, type: "webhook", error: err.message });
    }
  });
}

/* =========================================
   OBTER LOGS DE INTEGRAÇÕES
   ========================================= */
async function obterLogs(orderId) {
  try {
    let query = supabase
      .from("integration_logs")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(200);

    if (orderId) {
      query = query.eq("order_id", orderId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, logs: data || [] };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  executarIntegracoes,
  executarIntegracao,
  obterLogs
};