require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const morgan = require("morgan");

const routes = require("./routes");

const app = express();
app.use(morgan("dev"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use("/api", routes);

// Ensure the pedidos directory exists at start‑up
const pedidosDir =
  process.env.PEDIDOS_DIR || path.join(__dirname, "../pedidos");
if (!fs.existsSync(pedidosDir)) fs.mkdirSync(pedidosDir, { recursive: true });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅  Caseros app listening on port ${PORT}`);
});
