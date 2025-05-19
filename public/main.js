let currentCategory = null; // null = showing categories
/* ========= DOM ========= */
const sedeSegmented = document.getElementById("sedeSegmented");
const productGrid = document.getElementById("productGrid");
const searchBox = document.getElementById("searchBox");
const cartList = document.getElementById("cartList");
const submitBtn = document.getElementById("submitBtn");
const toast = document.getElementById("toast");
const signatureSection = document.getElementById("signatureSection");
const signatureCanvas = document.getElementById("signatureCanvas");
const clearSignatureBtn = document.getElementById("clearSignatureBtn");
const confirmSignatureBtn = document.getElementById("confirmSignatureBtn");
const userNameInput = document.getElementById("userName");

// Signature canvas setup
const ctx = signatureCanvas.getContext("2d");
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Set canvas size
signatureCanvas.width = signatureCanvas.offsetWidth;
signatureCanvas.height = signatureCanvas.offsetHeight;

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

/* ========= STATE ========= */
let PRODUCTS = {}; // { categoria: [ {nombre, unidad, …} ] }
const order = new Map(); // nombre -> { unidad, qty }

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
  const qty = order.get(p.nombre)?.qty || 0;
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
  plusBtn.addEventListener("click", () => {
    const curr = order.get(p.nombre)?.qty || 0;
    order.set(p.nombre, {
      unidad: p.unidad || "",
      empaqueRot: p.empaqueRot || "",
      qty: curr + 1,
    });
    updateCard(card, p.nombre);
    updateCart();
  });
  minusBtn.addEventListener("click", () => {
    const curr = order.get(p.nombre)?.qty || 0;
    if (curr > 0) {
      if (curr === 1) order.delete(p.nombre);
      else
        order.set(p.nombre, {
          unidad: p.unidad || "",
          empaqueRot: p.empaqueRot || "",
          qty: curr - 1,
        });
      updateCard(card, p.nombre);
      updateCart();
    }
  });
  return card;
}

function updateCard(card, nombre) {
  const span = card.querySelector("span");
  span.textContent = order.get(nombre)?.qty || 0;
}
function updateCart() {
  cartList.innerHTML = "";
  order.forEach((val, nombre) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>
        <strong>${nombre}</strong>
        <div style="font-size:0.85rem;color:var(--muted);margin:0.25rem 0;">${val.empaqueRot}</div>
        <span style="color:var(--muted)">x${val.qty}</span>
      </span>
      <button aria-label="Quitar">&times;</button>
    `;
    li.querySelector("button").onclick = () => {
      order.delete(nombre);
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
// Signature drawing functions
function startDrawing(e) {
  isDrawing = true;
  [lastX, lastY] = getPosition(e);
}

function draw(e) {
  if (!isDrawing) return;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  const [x, y] = getPosition(e);
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  [lastX, lastY] = [x, y];
}

function endDrawing() {
  isDrawing = false;
}

function getPosition(e) {
  const rect = signatureCanvas.getBoundingClientRect();
  return [
    (e.clientX || e.touches[0].clientX) - rect.left,
    (e.clientY || e.touches[0].clientY) - rect.top,
  ];
}

// Signature event listeners
signatureCanvas.addEventListener("mousedown", startDrawing);
signatureCanvas.addEventListener("mousemove", draw);
signatureCanvas.addEventListener("mouseup", endDrawing);
signatureCanvas.addEventListener("mouseleave", endDrawing);
signatureCanvas.addEventListener("touchstart", startDrawing);
signatureCanvas.addEventListener("touchmove", draw);
signatureCanvas.addEventListener("touchend", endDrawing);

clearSignatureBtn.addEventListener("click", () => {
  ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
});

submitBtn.addEventListener("click", () => {
  const sede = document.querySelector("input[name='sede']:checked")?.value;
  if (order.size === 0) return;

  // Show signature section
  signatureSection.style.display = "block";
  window.scrollTo({
    top: signatureSection.offsetTop,
    behavior: "smooth",
  });
});

confirmSignatureBtn.addEventListener("click", () => {
  if (
    !userNameInput.value ||
    signatureCanvas.toDataURL() === signatureCanvas.toDataURL("image/png", 0)
  ) {
    showToast("Por favor complete su nombre y firma");
    return;
  }

  const sede = document.querySelector("input[name='sede']:checked")?.value;
  const items = [...order].map(([nombre, { qty }]) => ({
    nombre,
    cantidad: qty,
  }));

  const signatureData = signatureCanvas.toDataURL();

  fetch("/api/submit-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sede,
      items,
      nombre: userNameInput.value,
      firma: signatureData,
    }),
  })
    .then((r) => r.json())
    .then((resp) => {
      if (resp.ok) {
        showToast("✅ Pedido enviado");
        order.clear();
        updateCart();
        signatureSection.style.display = "none";
        ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
        userNameInput.value = "";
      } else {
        showToast(resp.error || "Error");
      }
    })
    .catch(() => showToast("Error de red"));
});

/* ========= INIT ========= */
renderSedes();
loadProducts(); // this will call renderCategories after fetch
