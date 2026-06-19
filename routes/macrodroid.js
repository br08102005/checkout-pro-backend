const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { entregar } = require("../services/deliveryService");
const { executarIntegracoes } = require("../services/integrationService");
const { macrodroidLimiter } = require("../middleware/rateLimiter");

/* =========================================
   RECEBER NOTIFICAÇÃO DO MACRODROID
   ========================================= */
router.post("/notify", macrodroidLimiter, async (req, res) => {
  try {
    const {
      valor,           // valor pago
      data_hora,       // data/hora da transação
      texto,           // texto completo da mensagem
      notification_id  // identificador único da notificação
    } = req.body;

    // API Key obrigatória para endpoint MacroDroid
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== process.env.MACRODROID_API_KEY) {
      return res.status(401).json({
        success: false,
        error: "API Key inválida ou ausente"
      });
    }

    // Validar campos obrigatórios
    if (!valor) {
      return res.status(400).json({
        success: false,
        error: "Campo 'valor' é obrigatório"
      });
    }

    const amount = Number(valor);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valor inválido"
      });
    }

    /* =========================================
       IDEMPOTÊNCIA
       Se notification_id for fornecido, verificar
       se já foi processado
    ========================================= */
    if (notification_id) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("*")
        .eq("notification_id", String(notification_id))
        .maybeSingle();

      if (existing) {
        console.log(`[MACRODROID] Notificação duplicada ignorada: ${notification_id}`);
        return res.json({
          success: true,
          message: "Notificação já processada anteriormente",
          duplicated: true,
          status: existing.status
        });
      }
    }

    /* =========================================
       REGISTAR NOTIFICAÇÃO
    ========================================= */
    const notifId = notification_id || `manual-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

    const { data: notificacao, error: notifError } = await supabase
      .from("notifications")
      .insert([{
        notification_id: String(notifId),
        amount,
        reference: texto || null,
        transaction_date: data_hora || new Date().toISOString(),
        message_text: texto || null,
        status: "pending",
        raw_payload: req.body
      }])
      .select()
      .single();

    if (notifError) {
      // Se for erro de unique violation, já foi processado
      if (notifError.code === "23505") {
        return res.json({
          success: true,
          message: "Notificação já processada (unique constraint)",
          duplicated: true
        });
      }
      return res.status(500).json({ success: false, error: notifError.message });
    }

    /* =========================================
       PROCURAR PEDIDOS PENDING
       Apenas pedidos:
       - status = pending
       - criados há menos de 10 minutos
       - valor exactamente igual
    ========================================= */
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: candidatos, error: searchError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending")
      .eq("total", amount)
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false });

    if (searchError) {
      await supabase
        .from("notifications")
        .update({ status: "error" })
        .eq("id", notificacao.id);

      return res.status(500).json({ success: false, error: searchError.message });
    }

    /* =========================================
       CASO 1: NENHUM CANDIDATO
    ========================================= */
    if (!candidatos || candidatos.length === 0) {
      console.log(`[MACRODROID] Nenhum pedido pending encontrado para valor ${amount}`);

      await supabase
        .from("notifications")
        .update({ status: "ignored" })
        .eq("id", notificacao.id);

      return res.json({
        success: true,
        message: "Nenhum pedido pendente encontrado para este valor",
        matched: false
      });
    }

    /* =========================================
       CASO 2: APENAS UM CANDIDATO
    ========================================= */
    if (candidatos.length === 1) {
      const order = candidatos[0];
      return await processarPagamento(order, notificacao, res);
    }

    /* =========================================
       CASO 3: MÚLTIPLOS CANDIDATOS (MESMO VALOR)
       Usar sinais de desempate:
       - activity_score (maior = mais activo)
       - last_activity_at (mais recente = melhor)
       - heartbeat_at (mais recente = melhor)
       - last_payment_page_visit (mais recente = melhor)
       - created_at (mais recente = melhor)
    ========================================= */
    console.log(`[MACRODROID] ${candidatos.length} candidatos para valor ${amount}, a desempatar...`);

    const pontuados = candidatos.map(order => {
      let score = 0;

      // activity_score (0-10 pontos)
      score += Math.min(Number(order.activity_score || 0), 10);

      // last_activity_at (mais recente = mais pontos)
      if (order.last_activity_at) {
        const diffMs = Date.now() - new Date(order.last_activity_at).getTime();
        const diffMin = diffMs / 60000;
        if (diffMin < 2) score += 10;
        else if (diffMin < 5) score += 7;
        else if (diffMin < 8) score += 4;
        else score += 1;
      }

      // heartbeat_at (mais recente = mais pontos)
      if (order.heartbeat_at) {
        const diffMs = Date.now() - new Date(order.heartbeat_at).getTime();
        const diffMin = diffMs / 60000;
        if (diffMin < 1) score += 15;
        else if (diffMin < 3) score += 10;
        else if (diffMin < 5) score += 5;
      }

      // last_payment_page_visit (mais recente = mais pontos)
      if (order.last_payment_page_visit) {
        const diffMs = Date.now() - new Date(order.last_payment_page_visit).getTime();
        const diffMin = diffMs / 60000;
        if (diffMin < 2) score += 12;
        else if (diffMin < 5) score += 8;
        else if (diffMin < 8) score += 4;
      }

      // created_at (mais recente = ligeira vantagem)
      if (order.created_at) {
        const diffMs = Date.now() - new Date(order.created_at).getTime();
        const diffMin = diffMs / 60000;
        if (diffMin < 3) score += 3;
        else if (diffMin < 6) score += 2;
        else score += 1;
      }

      return { order, score };
    });

    // Ordenar por pontuação (decrescente)
    pontuados.sort((a, b) => b.score - a.score);

    const melhor = pontuados[0];
    const segundo = pontuados[1];

    // Se o melhor tem vantagem clara (diferença >= 10 pontos)
    if (!segundo || (melhor.score - segundo.score) >= 10) {
      console.log(`[MACRODROID] Candidato escolhido: ${melhor.order.order_id} (score: ${melhor.score})`);
      return await processarPagamento(melhor.order, notificacao, res);
    }

    /* =========================================
       DÚVIDA PERSISTE - MARCAR PARA REVISÃO MANUAL
    ========================================= */
    console.log(`[MACRODROID] Dúvida na escolha - melhor: ${melhor.score}, segundo: ${segundo.score}`);

    await supabase
      .from("notifications")
      .update({
        status: "manual_review",
        order_id: null
      })
      .eq("id", notificacao.id);

    return res.json({
      success: true,
      message: "Múltiplos candidatos com pontuação similar - marcar para revisão manual",
      matched: false,
      manual_review: true,
      candidates: candidatos.map(o => ({
        order_id: o.order_id,
        name: o.name,
        email: o.email,
        total: o.total,
        activity_score: o.activity_score,
        last_activity_at: o.last_activity_at,
        created_at: o.created_at
      }))
    });

  } catch (err) {
    console.error("[MACRODROID] Erro:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   PROCESSAR PAGAMENTO (função auxiliar)
   ========================================= */
async function processarPagamento(order, notificacao, res) {
  try {
    // Segurança: verificar se o pedido ainda está pending
    if (order.status !== "pending") {
      await supabase
        .from("notifications")
        .update({ status: "ignored", order_id: order.order_id })
        .eq("id", notificacao.id);

      return res.json({
        success: true,
        message: `Pedido ${order.order_id} já não está pendente (status: ${order.status})`,
        matched: false
      });
    }

    // Marcar pedido como pago
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        payment_confirmed_at: new Date().toISOString()
      })
      .eq("order_id", order.order_id)
      .select()
      .single();

    if (updateError) {
      await supabase
        .from("notifications")
        .update({ status: "error", order_id: order.order_id })
        .eq("id", notificacao.id);

      return res.status(500).json({ success: false, error: updateError.message });
    }

    // Actualizar notificação
    await supabase
      .from("notifications")
      .update({ status: "processed", order_id: order.order_id })
      .eq("id", notificacao.id);

    // Registar evento
    await supabase.from("events").insert([{
      event_type: "payment.confirmed",
      product_id: order.product_id,
      order_id: order.order_id,
      email: order.email,
      metadata: {
        amount: order.total,
        notification_id: notificacao.notification_id,
        matched_by: "macrodroid"
      }
    }]);

    /* =========================================
       ENTREGA AUTOMÁTICA
    ========================================= */
    const entregaResult = await entregar(updatedOrder);

    if (entregaResult.success) {
      console.log(`[ENTREGA] Produto entregue para pedido ${order.order_id}`);
    } else if (!entregaResult.alreadyDelivered) {
      console.error(`[ENTREGA] Falha na entrega: ${entregaResult.error}`);
    }

    /* =========================================
       EXECUTAR INTEGRAÇÕES
    ========================================= */
    const integracoesResult = await executarIntegracoes(updatedOrder);
    console.log(`[INTEGRAÇÕES] ${integracoesResult.executed || 0} integrações executadas para pedido ${order.order_id}`);

    return res.json({
      success: true,
      message: "Pagamento processado com sucesso",
      matched: true,
      order: {
        order_id: updatedOrder.order_id,
        status: updatedOrder.status,
        product_name: updatedOrder.product_name,
        total: updatedOrder.total,
        payment_confirmed_at: updatedOrder.payment_confirmed_at
      },
      delivery: entregaResult.success ? {
        delivered: true,
        delivery_type: entregaResult.deliveryType
      } : {
        delivered: false,
        error: entregaResult.error
      },
      integrations: {
        executed: integracoesResult.executed || 0
      }
    });

  } catch (err) {
    console.error("[PROCESSAR_PAGAMENTO] Erro:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/* =========================================
   LISTAR NOTIFICAÇÕES (admin)
   ========================================= */
router.get("/notifications", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, notifications: data || [] });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;