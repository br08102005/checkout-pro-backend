const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* =========================================
   SECURITY / BASE MIDDLEWARES
========================================= */
app.use(cors({
  origin: "*",
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
   SAFE ROUTE LOADER (EVITA CRASH TOTAL)
========================================= */
function safeRoute(path, file) {
  try {
    app.use(path, require(file));
    console.log(`✅ Route loaded: ${path}`);
  } catch (err) {
    console.error(`❌ Failed to load route ${path}:`, err.message);
  }
}

/* =========================================
   ROUTES CORE
========================================= */
safeRoute("/api/products", "./routes/products");
safeRoute("/api/checkout", "./routes/checkout");
safeRoute("/api/orders", "./routes/orders");
safeRoute("/api/payment", "./routes/payment");
safeRoute("/api/auth", "./routes/auth");
safeRoute("/api/dashboard", "./routes/dashboard");
safeRoute("/api/tracking", "./routes/tracking");

/* =========================================
   ORDER EXPIRATION SYSTEM
========================================= */
let expireOldOrders = null;

try {
  ({ expireOldOrders } = require("./services/orderService"));
} catch (err) {
  console.error("❌ orderService failed to load:", err.message);
}

async function runExpirationJob() {
  try {
    if (typeof expireOldOrders === "function") {
      await expireOldOrders();
    }
  } catch (err) {
    console.error("❌ Erro ao expirar orders:", err.message);
  }
}

setInterval(runExpirationJob, 60 * 1000);
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