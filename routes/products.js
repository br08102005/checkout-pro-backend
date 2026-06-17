const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

/* =========================
CRIAR PRODUTO
========================= */
router.post("/create", async (req, res) => {
try {
const { name, price, image, description = "", extras = [] } = req.body;

```
if (!name || !price) {
  return res.status(400).json({
    error: "Nome e preço são obrigatórios"
  });
}

const slug = name
  .toLowerCase()
  .trim()
  .replace(/\s+/g, "-")
  .replace(/[^a-z0-9-]/g, "");

const { data, error } = await supabase
  .from("products")
  .insert([
    {
      name,
      slug,
      price: Number(price),
      image: image || null,
      description,
      extras,
      active: true
    }
  ])
  .select()
  .single();

if (error) {
  return res.status(500).json({ error: error.message });
}

return res.json({
  success: true,
  product: data,
  checkout_url: `/checkout.html?product_id=${data.id}`
});
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
});

/* =========================
LISTAR PRODUTOS
========================= */
router.get("/", async (req, res) => {
try {
const { data, error } = await supabase
.from("products")
.select("*")
.order("created_at", { ascending: false });

```
if (error) {
  return res.status(500).json({ error: error.message });
}

return res.json({
  products: data || []
});
```

} catch (err) {
return res.status(500).json({ error: err.message });
}
});

module.exports = router;