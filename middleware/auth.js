const jwt = require("jsonwebtoken");

function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Verificar se o utilizador tem role de admin
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Acesso negado. Permissões insuficientes." });
    }

    req.admin = decoded;

    next();

  } catch (err) {
    return res.status(401).json({ error: "Acesso negado / Token inválido" });
  }
}

module.exports = { requireAdmin };
