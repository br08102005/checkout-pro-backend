const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json({ limit: "1mb" }));

/* HEALTH */
app.get("/", (req, res) => {
  res.json({
    message: "API ONLINE 🚀",
    status: "healthy"
  });
});

/* ROUTES (SEM ESCONDER ERROS) */
app.use("/api/products", require("./routes/products"));
app.use("/api/checkout", require("./routes/checkout"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/tracking", require("./routes/tracking"));

/* ORDER EXPIRATION */
const { expireOldOrders } = require("./services/orderService");

setInterval(async () => {
  try {
    await expireOldOrders();
  } catch (err) {
    console.error("Expire error:", err.message);
  }
}, 60000);

/* START */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor a correr na porta ${PORT}`);
});