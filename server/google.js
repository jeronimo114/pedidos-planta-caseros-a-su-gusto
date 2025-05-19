const { google } = require("googleapis");
const path = require("path");

// Auth – uses the service‑account key pointed to by GOOGLE_APPLICATION_CREDENTIALS
const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

/**
 * Reads products from the master spreadsheet and returns an array of objects.
 * Expected layout (zero‑based columns):
 *   B: Producto (index 1)
 *   D–H: EmpaquePrimario, Unidad, DosisPorPorcion, PorcionesPorEmpaque, CantidadPorEmpaque
 */
async function getProducts() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;
  const range = "Punto_Lista_pedidos_a_planta!B:H"; // Reads whole block

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = data.values || [];

  // Skip header (row 1‑3) – detect the first row whose B cell is *not* empty and C cell empty (categoria row)
  const products = [];
  let currentCategory = "";

  for (const row of rows) {
    const [
      producto /* C */,
      ,
      empaquePrimario,
      unidad,
      dosis,
      porciones,
      cantidadEmpaque,
    ] = row;

    // Row marks the start of a category when Producto has text and the empaquePrimario column is blank.
    if (producto && !empaquePrimario) {
      currentCategory = producto.trim();
      continue;
    }

    // Real product rows – ensure producto & empaque
    if (producto && empaquePrimario) {
      products.push({
        categoria: currentCategory,
        nombre: producto,
        empaquePrimario,
        unidad,
        dosis: Number(dosis) || null,
        porcionesPorEmpaque: Number(porciones) || null,
        cantidadPorEmpaque: Number(cantidadEmpaque) || null,
      });
    }
  }
  return products;
}

module.exports = {
  getProducts,
};
