const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAdmin } = require("../middleware/auth");

/* ================================
   📊 RESUMO (KPI CARDS)
================================ */
router.get("/summary", requireAdmin, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*");

    if (error) return res.status(500).json({ error: error.message });

    const safeOrders = orders || [];

    const paidOrders = safeOrders.filter(o => o.status === "paid");

    return res.json({
      success: true,
      summary: {
        totalSales: paidOrders.length,
        totalRevenue: paidOrders.reduce((s, o) => s + Number(o.total || 0), 0),
        pending: safeOrders.filter(o => o.status === "pending").length,
        cancelled: safeOrders.filter(o => o.status === "cancelled").length
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ================================
   📦 ORDERS LIST
================================ */
router.get("/orders", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      success: true,
      orders: data || []
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ================================
   📈 PRODUCTS PERFORMANCE
================================ */
router.get("/products-performance", requireAdmin, async (req, res) => {
  try {
    const { data: products, error: pError } = await supabase
      .from("products")
      .select("*");

    const { data: orders, error: oError } = await supabase
      .from("orders")
      .select("*");

    if (pError) return res.status(500).json({ error: pError.message });
    if (oError) return res.status(500).json({ error: oError.message });

    const safeProducts = products || [];
    const safeOrders = orders || [];

    const result = safeProducts.map(p => {
      const paid = safeOrders.filter(
        o => o.product_id === p.id && o.status === "paid"
      );

      return {
        name: p.name,
        sales: paid.length,
        revenue: paid.reduce((s, o) => s + Number(o.total || 0), 0)
      };
    });

    return res.json({
      success: true,
      products: result
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ================================
   📊 ANALYTICS (GRÁFICOS SAAS)
   - últimos 7 dias
   - base para Chart.js
================================ */
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const { data: orders } = await supabase
      .from("orders")
      .select("*");

    const safeOrders = orders || [];

    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));

      return {
        date: d.toISOString().split("T")[0],
        label: d.toLocaleDateString("pt-PT", { weekday: "short" })
      };
    });

    const analytics = last7Days.map(day => {
      const dayOrders = safeOrders.filter(o =>
        (o.created_at || "").split("T")[0] === day.date
      );

      const sales = dayOrders.filter(o => o.status === "paid").length;

      const revenue = dayOrders
        .filter(o => o.status === "paid")
        .reduce((s, o) => s + Number(o.total || 0), 0);

      return {
        day: day.label,
        sales,
        revenue
      };
    });

    const statusSummary = {
      paid: safeOrders.filter(o => o.status === "paid").length,
      pending: safeOrders.filter(o => o.status === "pending").length,
      cancelled: safeOrders.filter(o => o.status === "cancelled").length
    };

    return res.json({
      success: true,
      analytics,
      statusSummary
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;