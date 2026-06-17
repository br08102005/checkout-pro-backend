const supabase = require("../config/supabase");

async function expireOrders() {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("status", "pending")
      .lt("created_at", tenMinutesAgo.toISOString());

    if (error) {
      console.log("Erro ao expirar orders:", error.message);
    } else {
      console.log("Orders expiradas atualizadas");
    }

  } catch (err) {
    console.log(err.message);
  }
}

module.exports = expireOrders;