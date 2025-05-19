const express = require("express");
const path = require("path");
const fs = require("fs");
const stringify = require("csv-stringify").stringify;
const { getProducts } = require("./google");

const router = express.Router();

// Helpers
function sanitizeFilename(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

// Allowed sedes (update here if list changes)
const ALLOWED_SEDES = [
  "Punto Clave",
  "Politécnico Jaime Isaza Cadavid",
  "Centro comercial Gran Plaza",
  "Centro comercial Camino Real",
  "Centro comercial Bosque Plaza",
];

// GET /api/products – returns grouped by categoría
router.get("/products", async (req, res) => {
  try {
    const products = await getProducts();
    const grouped = {};
    for (const p of products) {
      if (!grouped[p.categoria]) grouped[p.categoria] = [];
      grouped[p.categoria].push(p);
    }
    res.json(grouped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al leer productos" });
  }
});

// POST /api/submit-order
router.post("/submit-order", (req, res) => {
  const { sede, items, nombre } = req.body;
  if (!ALLOWED_SEDES.includes(sede)) {
    return res.status(400).json({ error: "Sede inválida" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "La orden está vacía" });
  }
  if (!nombre) {
    return res.status(400).json({ error: "Falta nombre" });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `Pedido_${sanitizeFilename(sede)}_${today}.csv`;
  const pedidosDir =
    process.env.PEDIDOS_DIR || path.join(__dirname, "../pedidos");
  const filePath = path.join(pedidosDir, filename);

  // CSV header & rows
  const csvRows = [
    ["Producto", "Presentación", "Cantidad", "Nombre del Responsable"],
  ];
  items.forEach((item) => {
    if (item.nombre && Number(item.cantidad) > 0) {
      csvRows.push([
        item.nombre,
        item.presentacion || "",
        item.cantidad,
        nombre,
      ]);
    }
  });

  stringify(csvRows, (err, output) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al generar CSV" });
    }
    fs.writeFile(filePath, output, "utf8", (writeErr) => {
      if (writeErr) {
        console.error(writeErr);
        return res.status(500).json({ error: "No se pudo guardar la orden" });
      }
      console.log(`✔️  Orden guardada en ${filePath}`);
      res.json({ ok: true, file: filePath });
    });
  });
});

module.exports = router;
