const SEDE_OPTIONS = [
  "Punto Clave",
  "Politécnico Jaime Isaza Cadavid",
  "Centro comercial Gran Plaza",
  "Centro comercial Camino Real",
  "Centro comercial Bosque Plaza",
];

const sedeSelect = document.getElementById("sedeSelect");
const searchBox = document.getElementById("searchBox");
const productsTable = document.getElementById("productsTable");
const orderForm = document.getElementById("orderForm");
const toast = document.getElementById("toast");

SEDE_OPTIONS.forEach((s) => {
  const opt = document.createElement("option");
  opt.value = opt.textContent = s;
  sedeSelect.appendChild(opt);
});

function showToast(msg) {
  toast.textContent = msg;
  toast.showModal();
  setTimeout(() => toast.close(), 3000);
}

fetch("/api/products")
  .then((r) => r.json())
  .then(renderTable)
  .catch(() => showToast("Error cargando productos"));

function renderTable(data) {
  productsTable.innerHTML = "";
  for (const categoria in data) {
    const trCat = productsTable.insertRow();
    const td = trCat.insertCell();
    td.colSpan = 3;
    td.textContent = categoria;
    td.className = "category";

    data[categoria].forEach((prod) => {
      const row = productsTable.insertRow();
      const nameCell = row.insertCell();
      nameCell.textContent = prod.nombre;
      const qtyCell = row.insertCell();
      const input = document.createElement("input");
      input.type = "number";
      input.min = 0;
      input.dataset.product = prod.nombre;
      qtyCell.appendChild(input);
    });
  }
}

// Simple filter
searchBox.addEventListener("input", () => {
  const term = searchBox.value.toLowerCase();
  [...productsTable.rows].forEach((r) => {
    if (r.classList.contains("category")) return;
    const show = r.cells[0].textContent.toLowerCase().includes(term);
    r.style.display = show ? "" : "none";
  });
});

orderForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const sede = sedeSelect.value;
  const items = [...productsTable.querySelectorAll('input[type="number"]')]
    .filter((i) => Number(i.value) > 0)
    .map((i) => ({ nombre: i.dataset.product, cantidad: Number(i.value) }));
  if (items.length === 0) return showToast("Añade al menos un producto");

  fetch("/api/submit-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sede, items }),
  })
    .then((r) => r.json())
    .then((resp) =>
      resp.ok ? showToast("✅ Pedido enviado") : showToast(resp.error)
    )
    .catch(() => showToast("Error al enviar pedido"));
});
