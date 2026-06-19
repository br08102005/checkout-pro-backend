const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
      callback(null, true);
    } else {
      callback(new Error("Origin not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));

/* =========================
   HEALTH CHECK
   ========================= */
app.get("/", (req, res) => {
  res.json({
    message: "Checkout Pro API Online",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

/* =========================
   ADVANCED HEALTH CHECK
   ========================= */
app.get("/health", async (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {}
  };

  // Check Supabase connection
  try {
    const supabase = require("./config/supabase");
    const { error } = await supabase
      .from("products")
      .select("id")
      .limit(1);
    
    health.checks.database = {
      status: error ? "unhealthy" : "healthy",
      error: error?.message || null
    };
    
    if (error) health.status = "degraded";
  } catch (err) {
    health.checks.database = { status: "unhealthy", error: err.message };
    health.status = "unhealthy";
  }

  const isHealthy = health.status === "healthy";
  res.status(isHealthy ? 200 : 503).json(health);
});

/* =========================
   METRICS ENDPOINT
   ========================= */
const metrics = {
  requests: 0,
  errors: 0,
  avgResponseTime: 0,
  lastRequest: null,
  startTime: Date.now()
};

// Middleware para coletar métricas
app.use((req, res, next) => {
  const start = Date.now();
  metrics.requests++;
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    metrics.avgResponseTime = metrics.avgResponseTime === 0 
      ? responseTime 
      : (metrics.avgResponseTime + responseTime) / 2;
    metrics.lastRequest = new Date().toISOString();
    
    if (res.statusCode >= 400) {
      metrics.errors++;
    }
  });
  
  next();
});

app.get("/metrics", (req, res) => {
  res.json({
    ...metrics,
    errorRate: metrics.requests > 0 
      ? (metrics.errors / metrics.requests * 100).toFixed(2) + '%' 
      : '0%',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

/* =========================
   ROUTE LOADER (STRICT - throws on error)
   ========================= */
function loadRoute(path, file) {
  try {
    const route = require(file);
    app.use(path, route);
    console.log(`✓ Route loaded: ${path}`);
  } catch (err) {
    console.error(`✗ Failed to load route ${path}:`, err.message);
    console.error(`  File: ${file}`);
    console.error(`  Stack: ${err.stack}`);
    // Don't throw - allow server to start even if one route fails
  }
}

/* =========================
   ROUTES - ORDER MATTERS!
   Specific routes MUST be before /:id
   ========================= */
console.log("\n=== Loading Routes ===");

// Products - specific routes first
loadRoute("/api/products", "./routes/products");

// Checkout
loadRoute("/api/checkout", "./routes/checkout");

// Orders
loadRoute("/api/orders", "./routes/orders");

// Payment
loadRoute("/api/payment", "./routes/payment");

// Auth
loadRoute("/api/auth", "./routes/auth");

// Dashboard
loadRoute("/api/dashboard", "./routes/dashboard");

// Tracking
loadRoute("/api/tracking", "./routes/tracking");

// Funnel
loadRoute("/api/funnel", "./routes/funnel");

// Integrations
loadRoute("/api/integrations", "./routes/integrations");

// Events
loadRoute("/api/events", "./routes/events");

// MacroDroid
loadRoute("/api/macrodroid", "./routes/macrodroid");

// Delivery
loadRoute("/api/delivery", "./routes/delivery");

// Admin
loadRoute("/api/admin", "./routes/admin");

console.log("=== Routes Loaded ===\n");

/* =========================
   ORDER EXPIRATION
   ========================= */
let expireOldOrders = null;

try {
  ({ expireOldOrders } = require("./services/orderService"));
} catch (err) {
  console.error("orderService not loaded:", err.message);
}

if (typeof expireOldOrders === "function") {
  setInterval(async () => {
    try {
      await expireOldOrders();
    } catch (err) {
      console.error("Expire error:", err.message);
    }
  }, 60000);
}

/* =========================
   GLOBAL ERROR HANDLER
   ========================= */
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    error: "Internal server error",
    message: err.message
  });
});

/* =========================
   404 HANDLER - with helpful message
   ========================= */
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
    hint: "Check /api/products/:id - ensure server was restarted after code changes"
  });
});

/* =========================
   START SERVER
   ========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log(`✓ Checkout Pro API running on port ${PORT}`);
  console.log(`✓ Health: http://localhost:${PORT}/`);
  console.log(`✓ Products: http://localhost:${PORT}/api/products`);
  console.log("=".repeat(50) + "\n");
});