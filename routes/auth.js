const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* ================================
   LOGIN ADMIN
================================ */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Dados inválidos"
      });
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error || !admin) {
      return res.status(401).json({
        success: false,
        error: "Login inválido"
      });
    }

    const valid = await bcrypt.compare(
      password,
      admin.password
    );

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Login inválido"
      });
    }

    // TOKEN COM ROLE ADMIN
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: "admin"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    return res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: "admin"
      }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;