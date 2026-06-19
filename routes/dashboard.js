const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAdmin } = require("../middleware/auth");

/* ================================
   SAFE HELPERS
================================ */
function safeArray(data) {
  return Array.isArray(data) ? data : [];
}

/* ================================
   📊 RESUMO (KPI CARDS)
   + CACHE FRIENDLY
================================ */
router.get("/summary", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("status,total,product_id");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const orders = safeArray(data);

    const paid = orders.filter(o => o.status === "paid");
    const pending = orders.filter(o => o.status === "pending");
    const cancelled = orders.filter(o => o.status === "cancelled");

    const totalRevenue = paid.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0
    );

    return res.json({
      success: true,
      summary: {
        totalSales: paid.length,
        totalRevenue,
        pending: pending.length,
        cancelled: cancelled.length
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ================================
   📦 ORDERS LIST (LIGHTWEIGHT)
================================ */
router.get("/orders", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      success: true,
      orders: safeArray(data)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ================================
   📈 PRODUCTS PERFORMANCE (OPTIMIZED)
   - evita N+1 loops pesados
================================ */
router.get("/products-performance", requireAdmin, async (req, res) => {
  try {
    const [pRes, oRes] = await Promise.all([
      supabase.from("products").select("id,name"),
      supabase.from("orders").select("product_id,total,status")
    ]);

    if (pRes.error) return res.status(500).json({ error: pRes.error.message });
    if (oRes.error) return res.status(500).json({ error: oRes.error.message });

    const products = safeArray(pRes.data);
    const orders = safeArray(oRes.data);

    const paidOrders = orders.filter(o => o.status === "paid");

    const result = products.map(p => {
      const productOrders = paidOrders.filter(
        o => o.product_id === p.id
      );

      return {
        name: p.name || "Sem nome",
        sales: productOrders.length,
        revenue: productOrders.reduce(
          (sum, o) => sum + Number(o.total || 0),
          0
        )
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
   📊 ANALYTICS (7 DIAS)
   - mais estável e consistente
================================ */
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("created_at,status,total");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const orders = safeArray(data);

    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));

      const date = d.toISOString().split("T")[0];

      return {
        date,
        label: d.toLocaleDateString("pt-PT", { weekday: "short" })
      };
    });

    const analytics = last7Days.map(day => {
      const dayOrders = orders.filter(o =>
        (o.created_at || "").slice(0, 10) === day.date
      );

      const paid = dayOrders.filter(o => o.status === "paid");

      return {
        day: day.label,
        sales: paid.length,
        revenue: paid.reduce(
          (sum, o) => sum + Number(o.total || 0),
          0
        )
      };
    });

    const statusSummary = {
      paid: orders.filter(o => o.status === "paid").length,
      pending: orders.filter(o => o.status === "pending").length,
      cancelled: orders.filter(o => o.status === "cancelled").length
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