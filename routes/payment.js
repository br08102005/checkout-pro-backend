const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/* =========================
GET ORDER BY ID
========================= */
router.get("/orders/:id", async (req, res) => {
try {
const orderId = req.params.id;

```
const { data, error } = await supabase
  .from("orders")
  .select("*")
  .eq("id", orderId)
  .single();

if (error) {
  return res.status(404).json({
    error: "Order not found"
  });
}

return res.json({
  order: data
});
```

} catch (err) {
return res.status(500).json({
error: err.message
});
}
});

/* =========================
TRACK PAYMENT ACTIVITY
========================= */
router.post("/orders/:id/activity", async (req, res) => {
try {
const orderId = req.params.id;
const { event } = req.body;

```
const { data, error } = await supabase
  .from("order_activity")
  .insert([
    {
      order_id: orderId,
      event,
      created_at: new Date().toISOString()
    }
  ]);

if (error) {
  return res.status(400).json({
    error: error.message
  });
}

return res.json({
  success: true,
  data
});
```

} catch (err) {
return res.status(500).json({
error: err.message
});
}
});

/* =========================
CONFIRM PAYMENT
========================= */
router.post("/confirm", async (req, res) => {
try {
const { orderId } = req.body;

```
if (!orderId) {
  return res.status(400).json({
    error: "orderId é obrigatório"
  });
}

const { error } = await supabase
  .from("orders")
  .update({
    status: "paid"
  })
  .eq("id", orderId);

if (error) {
  return res.status(400).json({
    error: error.message
  });
}

return res.json({
  success: true,
  message: "Payment confirmed"
});
```

} catch (err) {
return res.status(500).json({
error: err.message
});
}
});

module.exports = router;
