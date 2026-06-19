const rateLimit = require("express-rate-limit");

// Rate limiter para endpoint MacroDroid
// Máximo 10 requisições por minuto por IP
const macrodroidLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requisições por minuto
  message: {
    success: false,
    error: "Demasiadas requisições. Tente novamente dentro de 1 minuto."
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { macrodroidLimiter };