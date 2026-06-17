const supabase = require("../config/supabase");

/* =========================================
   EXPIRAR ORDERS ANTIGAS
========================================= */
async function expireOldOrders() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .lt("created_at", tenMinutesAgo.toISOString());

  if (error) {
    console.log("Erro ao expirar orders:", error.message);
  }
}

module.exports = {
  expireOldOrders
};