// Rutas de discovery compatibles con Coinbase Bazaar
// GET /discovery/resources → listado machine-readable
// GET /.well-known/x402.json → well-known x402

import { Router } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { discoveryCatalog } from "../../scripts/lib/site.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

function loadData() {
  const raw = readFileSync(join(ROOT, "data", "apis.json"), "utf-8");
  return JSON.parse(raw);
}

export function discoveryRoutes() {
  const router = Router();

  // Bazaar-compatible discovery endpoint (misma forma que el estático de build)
  router.get("/resources", (req, res) => {
    res.json(discoveryCatalog(loadData()));
  });

  router.get("/resources.json", (req, res) => {
    res.json(discoveryCatalog(loadData()));
  });

  return router;
}
