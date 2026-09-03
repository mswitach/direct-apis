#!/usr/bin/env node
// Servidor ligero para LupaPlaza (local-only).
// Sirve el sitio estático + rutas dinámicas para agentes (discovery, MCP, submit).
// Decisión 28 Ago: este Express NO se publica en Fly/Railway. En Vercel/Pages
// solo vive el public/ generado por npm run build.

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { discoveryRoutes } from "./routes/discovery.mjs";
import { mcpRoutes } from "./routes/mcp.mjs";
import { apiRoutes } from "./routes/api.mjs";
import { SITE_NAME, LOCAL_PORT, wellKnownDocument } from "../scripts/lib/site.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const PORT = process.env.PORT || LOCAL_PORT;

const app = express();

app.use(express.json());

// /.well-known/x402.json - declaración del marketplace (local: incluye /api/search)
app.get("/.well-known/x402.json", (req, res) => {
  const origin = `${req.protocol}://${req.get("host")}`;
  res.json(wellKnownDocument(origin, { staticHost: false }));
});

// Rutas dinámicas para agentes
app.use("/discovery", discoveryRoutes());
app.use("/mcp", mcpRoutes());
app.use("/api", apiRoutes());

// Sitio estático (generado por build.mjs)
app.use(express.static(PUBLIC));

// 404 personalizado
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

app.listen(PORT, () => {
  console.log(`🔎 ${SITE_NAME} listening on http://localhost:${PORT}`);
  console.log(`   /discovery/resources → Bazaar discovery (también estático en public/)`);
  console.log(`   /.well-known/x402.json → x402 well-known`);
  console.log(`   /mcp → MCP tools (español; call-through solo acá)`);
  console.log(`   /api/search → búsqueda con facetas (local)`);
  console.log(`   /api/submit → envío de seller (local)`);
});
