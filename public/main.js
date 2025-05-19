let currentCategory = null; // null = showing categories
/* ========= DOM ========= */
const sedeSegmented = document.getElementById("sedeSegmented");
const productGrid = document.getElementById("productGrid");
const searchBox = document.getElementById("searchBox");
const cartList = document.getElementById("cartList");
const submitBtn = document.getElementById("submitBtn");
const toast = document.getElementById("toast");
const nameSection = document.getElementById("nameSection");
const userNameInput = document.getElementById("userName");
const confirmNameBtn = document.getElementById("confirmNameBtn");

/* ========= CONSTANTS ========= */
const SEDE_OPTIONS = [
  "Punto Clave",
  "Politécnico Jaime Isaza Cadavid",
  "Centro comercial Gran Plaza",
  "Centro comercial Camino Real",
  "Centro comercial Bosque Plaza",
];

// map raw → uniform
function norm(p) {
  const empaqueRaw =
    p.unidadEmpaqueRotulado || p.empaqueRotulado || p.unidadEmpaque || "";
  const auto = p.cantidadUnidad ? `Bolsa por ${p.cantidadUnidad} g` : "";
  return {
    ...p,
    unidad: p.unidad || p.unidadMedida || "",
    empaqueRot: empaqueRaw || auto,
  };
}

// Build a unique key for each product based on name + packaging
const productKey = (p) => `${p.nombre}|${p.empaqueRot}`;

/* ========= STATE ========= */
let PRODUCTS = {}; // { categoria: [ {nombre, unidad, …} ] }
const order = new Map(); // nombre -> { unidad, qty }
// Track last click timestamp per product to ignore rapid double clicks
const lastClickTimes = new Map(); // nombre -> ms

/* ========= UI HELPERS ========= */
function showToast(msg) {
  toast.textContent = msg;
  toast.showModal();
  setTimeout(() => toast.close(), 2500);
}
function renderSedes() {
  SEDE_OPTIONS.forEach((s, i) => {
    const id = `sede-${i}`;
    sedeSegmented.insertAdjacentHTML(
      "beforeend",
      `
      <input type="radio" name="sede" id="${id}" value="${s}" ${
        i === 0 ? "checked" : ""
      }>
      <label for="${id}">${s}</label>
    `
    );
  });
}
function renderCategories(filter = "") {
  productGrid.innerHTML = "";
  const term = filter.toLowerCase();
  Object.entries(PRODUCTS).forEach(([cat, items]) => {
    if (term && !cat.toLowerCase().includes(term)) return;
    const card = document.createElement("div");
    card.className = "card category-card";
    card.innerHTML = `<h4>${cat}</h4><div class="chip">${items.length} productos</div>`;
    card.onclick = () => openCategory(cat);
    productGrid.appendChild(card);
  });
}

function renderProducts(cat, filter = "") {
  productGrid.innerHTML = "";
  const term = filter.toLowerCase();
  PRODUCTS[cat]
    .filter((p) => p.nombre.toLowerCase().includes(term))
    .forEach((p) => productGrid.appendChild(productCard(p)));
}

function productCard(p) {
  const qty = order.get(productKey(p))?.qty || 0;
  const key = productKey(p);
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
     <h4>${p.nombre}</h4>
     <div class="chip">${p.empaqueRot}</div>
     <div class="controls">
       <button class="qty-btn minus" aria-label="Restar"><i class="fa-solid fa-minus"></i></button>
       <span>${qty}</span>
       <button class="qty-btn plus" aria-label="Agregar"><i class="fa-solid fa-plus"></i></button>
     </div>
  `;
  const [minusBtn, , plusBtn] = card.querySelectorAll(".qty-btn, span");
  // Attach once: prevent multiple listeners on the same element
  if (!plusBtn.dataset.boundPlus) {
    plusBtn.dataset.boundPlus = "true";

    // Single‑click handler with a short lock to avoid accidental double increments
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const now = performance.now();
      const last = lastClickTimes.get(key) || 0;
      if (now - last < 300) {
        console.log(
          `[IGNORED] Duplicate click on ${p.nombre} – ${(now - last).toFixed(
            1
          )} ms apart`
        );
        return;
      }
      lastClickTimes.set(key, now);

      const nowLog = performance.now();
      console.log(`[CLICK +] ${p.nombre} @ ${nowLog.toFixed(2)} ms`);

      const curr = order.get(key)?.qty || 0;
      console.log(`[STATE] ${p.nombre}: ${curr} → ${curr + 1}`);

      order.set(key, {
        nombre: p.nombre,
        unidad: p.unidad || "",
        empaqueRot: p.empaqueRot || "",
        qty: curr + 1,
      });
      updateCard(card, key);
      updateCart();
    });
  }
  if (!minusBtn.dataset.boundMinus) {
    minusBtn.dataset.boundMinus = "true";
    minusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const now = performance.now();
      const last = lastClickTimes.get(key) || 0;
      if (now - last < 300) return; // ignore ultra‑fast repeats
      lastClickTimes.set(key, now);

      console.log(`[CLICK -] ${p.nombre}`);
      const curr = order.get(key)?.qty || 0;
      if (curr > 0) {
        if (curr === 1) order.delete(key);
        else
          order.set(key, {
            nombre: p.nombre,
            unidad: p.unidad || "",
            empaqueRot: p.empaqueRot || "",
            qty: curr - 1,
          });
        updateCard(card, key);
        updateCart();
      }
    });
  }
  return card;
}

function updateCard(card, key) {
  const span = card.querySelector("span");
  span.textContent = order.get(key)?.qty || 0;
}
function updateCart() {
  cartList.innerHTML = "";
  order.forEach((val, key) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>
        <strong>${val.nombre}</strong>
        <div style="font-size:0.85rem;color:var(--muted);margin:0.25rem 0;">${val.empaqueRot}</div>
        <span style="color:var(--muted)">x${val.qty}</span>
      </span>
      <button aria-label="Quitar">&times;</button>
    `;
    li.querySelector("button").onclick = () => {
      order.delete(key);
      updateCart();
    };
    cartList.appendChild(li);
  });
  submitBtn.disabled = order.size === 0;
  const cart = document.getElementById("cart");
  cart.style.display = order.size ? "flex" : "none";
}

/* ========= NETWORK ========= */
function loadProducts() {
  fetch("/api/products")
    .then((r) => r.json())
    .then((data) => {
      PRODUCTS = data;
      Object.keys(data).forEach((cat) => {
        // descartar categoría "SEDE:" y vacías
        if (cat.trim().toLowerCase() === "sede:") {
          delete data[cat];
          return;
        }
        data[cat] = data[cat]
          .map(norm)
          .filter((p) => !/pedidos a planta|^producto\s*$/i.test(p.nombre));
      });
      renderCategories();
    })
    .catch(() => showToast("Error cargando productos"));
}

/* ========= EVENT BINDINGS ========= */
searchBox.addEventListener("input", (e) => {
  const term = e.target.value;
  currentCategory
    ? renderProducts(currentCategory, term)
    : renderCategories(term);
});
const backBtn = document.getElementById("backBtn");

function openCategory(cat) {
  currentCategory = cat;
  backBtn.style.display = "inline-flex";
  renderProducts(cat);
}

backBtn.onclick = () => {
  currentCategory = null;
  backBtn.style.display = "none";
  renderCategories(searchBox.value);
};

submitBtn.addEventListener("click", () => {
  if (order.size === 0) return;
  nameSection.style.display = "block";
  userNameInput.focus();
  window.scrollTo({ top: nameSection.offsetTop, behavior: "smooth" });
});

confirmNameBtn.addEventListener("click", () => {
  const nombre = userNameInput.value.trim();
  if (!nombre) {
    showToast("Por favor ingrese su nombre");
    return;
  }
  sendOrder(nombre);
});

function sendOrder(nombre) {
  const sede = document.querySelector("input[name='sede']:checked")?.value;
  const items = [...order].map(([key, val]) => ({
    nombre: val.nombre,
    presentacion: val.empaqueRot,
    cantidad: val.qty,
  }));

  console.log("Submitting order:", { sede, nombre, items, firma: "N/A" });
  fetch("/api/submit-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sede, nombre, items, firma: "N/A" }),
  })
    .then((r) => r.json())
    .then((resp) => {
      if (resp.ok) {
        showToast("✅ Pedido enviado");
        order.clear();
        updateCart();
        nameSection.style.display = "none";
        userNameInput.value = "";
      } else {
        showToast(resp.error || "Error");
      }
    })
    .catch(() => showToast("Error de red"));
}

/* ========= INIT ========= */
renderSedes();
loadProducts(); // this will call renderCategories after fetch
