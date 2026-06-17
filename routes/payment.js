let orderId = localStorage.getItem("ORDER_ID");

const params = new URLSearchParams(window.location.search);
const orderIdFromUrl = params.get("id");

if (orderIdFromUrl) {
  orderId = orderIdFromUrl;
  localStorage.setItem("ORDER_ID", orderIdFromUrl);
}

const bar = document.getElementById("bar");
let progress = 0;

function setProgress(value) {
  progress = Math.min(100, progress + value);
  if (bar) bar.style.width = progress + "%";

  sendPixel(progress);
}

async function trackActivity(event) {
  if (!orderId) return;

  try {
    await fetch(`https://checkout-backend-ycts.onrender.com/api/orders/${orderId}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event })
    });
  } catch (err) {
    console.error(err);
  }
}

/* =========================
   CARREGAR ORDER
========================= */
async function loadOrder() {
  if (!orderId) {
    document.getElementById("statusBox").innerText = "Pedido não encontrado";
    return;
  }

  try {
    const res = await fetch(
      `https://checkout-backend-ycts.onrender.com/api/orders/${orderId}`
    );

    const data = await res.json();

    if (!data || !data.order) {
      document.getElementById("statusBox").innerText = "Erro ao carregar pedido";
      return;
    }

    const order = data.order;

    // VALOR
    const total = Number(order.total || 0);
    document.getElementById("valorBox").innerText =
      total.toLocaleString("pt-PT") + " KZ";

    // ENTIDADE E REFERÊNCIA (FIXOS NO MOMENTO)
    document.getElementById("entityBox").innerText = "00525";
    document.getElementById("referenceBox").innerText = order.order_id;

    // STATUS PENDING
    if (order.status !== "paid") {
      document.getElementById("statusBox").innerText =
        "⏳ Aguardando pagamento...";
      return;
    }

    // STATUS PAGO
    document.getElementById("statusBox").innerText =
      "✔ Pagamento confirmado";

    const unlockBox = document.getElementById("unlockBox");
    if (unlockBox) unlockBox.style.display = "block";

    document.querySelector(".progress").style.display = "none";
    document.querySelectorAll(".row").forEach(el => el.style.display = "none");
    document.querySelectorAll(".title, .info").forEach(el => {
      if (!el.closest("#unlockBox")) el.style.display = "none";
    });

    // PRODUTOS
    const container = document.getElementById("linksContainer");
    container.innerHTML = "";

    let delivered = [];

    try {
      delivered =
        typeof order.delivered_products === "string"
          ? JSON.parse(order.delivered_products)
          : order.delivered_products || [];
    } catch (e) {
      delivered = [];
    }

    if (!delivered.length) {
      container.innerHTML = `<div>Nenhum produto disponível</div>`;
      return;
    }

    delivered.forEach(p => {
      container.innerHTML += `
        <div class="product-card">
          <img src="${p.image}" class="product-img"/>
          <div class="product-name">${p.name}</div>
          <div class="product-actions">
            <button onclick="window.open('${p.link}', '_blank')">Abrir</button>
            <button onclick="navigator.clipboard.writeText('${p.link}')">Copiar</button>
          </div>
        </div>
      `;
    });

  } catch (err) {
    console.error(err);
    document.getElementById("statusBox").innerText = "Erro de conexão";
  }
}

/* =========================
   COPY FUNCTIONS
========================= */
function copyEntity() {
  navigator.clipboard.writeText("00525");
  setProgress(20);
  trackActivity("copy_entity");
}

function copyReference() {
  navigator.clipboard.writeText(document.getElementById("referenceBox").innerText);
  setProgress(25);
  trackActivity("copy_reference");
}

function copyValue() {
  const val = document.getElementById("valorBox").innerText;
  navigator.clipboard.writeText(val);
  setProgress(50);
  trackActivity("copy_amount");
}

/* =========================
   TRACKING VISIBILITY
========================= */
window.addEventListener("focus", () => {
  setProgress(5);
  trackActivity("payment_page_visible");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    setProgress(5);
    trackActivity("payment_page_visible");
  }
});

trackActivity("payment_page_open");
setProgress(10);

/* =========================
   INIT LOOP
========================= */
loadOrder();
setInterval(loadOrder, 3000);

/* =========================
   PIXEL EVENTS
========================= */
let fired10 = false;
let fired30 = false;
let fired60 = false;
let fired100 = false;

function sendPixel(progress) {
  if (!window.fbq) return;

  if (progress >= 10 && !fired10) {
    fbq("trackCustom", "Progress_10");
    fired10 = true;
  }

  if (progress >= 30 && !fired30) {
    fbq("trackCustom", "Progress_30");
    fired30 = true;
  }

  if (progress >= 60 && !fired60) {
    fbq("trackCustom", "Progress_60");
    fired60 = true;
  }

  if (progress >= 100 && !fired100) {
    fbq("track", "Lead");
    fired100 = true;
  }
}