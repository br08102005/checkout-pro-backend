require("dotenv").config();

const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

/* =========================
   VALIDAR ENV
========================= */
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.log("❌ Variáveis .env em falta");
  process.exit(1);
}

/* =========================
   SUPABASE CLIENT
========================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function createAdmin() {
  try {
    const email = "admin@site.com";
    const password = "123456";

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("admin_users")
      .insert([
        {
          email,
          password: hashedPassword
        }
      ])
      .select();

    if (error) {
      console.log("❌ ERRO SUPABASE:", error.message);
      return;
    }

    console.log("✅ ADMIN CRIADO COM SUCESSO");
    console.log(data);

  } catch (err) {
    console.log("❌ ERRO GERAL:", err.message);
  }
}

createAdmin();