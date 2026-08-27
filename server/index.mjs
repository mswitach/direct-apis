#!/usr/bin/env node
// Servidor ligero para Marketplace 402
// Sirve el sitio estático + rutas dinámicas para agentes (discovery, MCP, submit)

import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { discoveryRoutes } from "./routes/discovery.mjs";
import { mcpRoutes } from "./routes/mcp.mjs";
import { apiRoutes } from "./routes/api.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const PORT = process.env.PORT || 3402;

const app = express();

app.use(express.json());

// /.well-known/x402.json - declaración del marketplace
app.get("/.well-known/x402.json", (req, res) => {
  res.json({
    name: "Marketplace 402",
    description: "Catálogo chico y confiable de APIs LatAm pagables por uso vía x402",
    version: "2.0.0",
    protocol: "x402",
    marketplace: true,
    discovery: {
      resources: `${req.protocol}://${req.get("host")}/discovery/resources`,
      search: `${req.protocol}://${req.get("host")}/api/search`,
      openapi: `${req.protocol}://${req.get("host")}/openapi.json`
    },
    mcp: {
      manifest: `${req.protocol}://${req.get("host")}/mcp`,
      language: "es"
    },
    regions: ["AR", "MX", "CO", "BR", "CL", "PE"],
    contact: {
      name: "Marcelo Switach",
      url: "https://github.com/mswitach/direct-apis"
    }
  });
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
  console.log(`🧾 Marketplace 402 listening on http://localhost:${PORT}`);
  console.log(`   /discovery/resources → Bazaar discovery`);
  console.log(`   /.well-known/x402.json → x402 well-known`);
  console.log(`   /mcp → MCP tools (español)`);
  console.log(`   /api/search → búsqueda con facetas`);
  console.log(`   /api/submit → envío de seller`);
});
