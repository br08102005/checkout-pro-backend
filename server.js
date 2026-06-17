const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* =========================================
   SECURITY / BASE MIDDLEWARES
========================================= */
app.use(cors({
  origin: "*", // em produção troca para o teu domínio
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use(express.json({ limit: "1mb" }));

/* =========================================
   HEALTH CHECK
========================================= */
app.get("/", (req, res) => {
  res.json({
    message: "API ONLINE 🚀",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

/* =========================================
   ROUTES CORE
========================================= */
app.use("/api/products", require("./routes/products"));
app.use("/api/checkout", require("./routes/checkout"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/payment", require("./routes/payment"));

/* 🔥 AUTH ROUTES (FALTAVA ISTO) */
app.use("/api/auth", require("./routes/auth"));

/* DASHBOARD */
app.use("/api/dashboard", require("./routes/dashboard"));

/* TRACKING (FUNNEL) */
app.use("/api/tracking", require("./routes/tracking"));

/* =========================================
   ORDER EXPIRATION SYSTEM
   (10 min rule - core business logic)
========================================= */
const { expireOldOrders } = require("./services/orderService");

async function runExpirationJob() {
  try {
    await expireOldOrders();
  } catch (err) {
    console.error("❌ Erro ao expirar orders:", err.message);
  }
}

/* roda a cada 60 segundos */
setInterval(runExpirationJob, 60 * 1000);

/* execução inicial */
runExpirationJob();

/* =========================================
   GLOBAL ERROR HANDLER
========================================= */
app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);

  res.status(500).json({
    error: "Internal server error",
    message: err.message
  });
});

/* =========================================
   404 HANDLER
========================================= */
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

/* =========================================
   START SERVER
========================================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor a correr na porta ${PORT}`);
});