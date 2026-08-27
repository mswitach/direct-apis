// Rutas de discovery compatibles con Coinbase Bazaar
// GET /discovery/resources → listado machine-readable
// GET /.well-known/x402.json → well-known x402

import { Router } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

function loadData() {
  const raw = readFileSync(join(ROOT, "data", "apis.json"), "utf-8");
  return JSON.parse(raw);
}

export function discoveryRoutes() {
  const router = Router();

  // Bazaar-compatible discovery endpoint
  router.get("/resources", (req, res) => {
    const data = loadData();
    
    const resources = data.apis
      .filter(api => api.endpoint_url) // solo APIs con endpoint definido
      .map(api => ({
        id: api.id,
        name: api.name,
        description: api.description,
        url: api.endpoint_url || api.url,
        category: api.category,
        tags: api.taxonomy || [],
        price: api.price_display,
        network: api.network,
        payTo: api.pay_to,
        callable: api.callable || "unchecked",
        lastProbed: api.last_probed_at || null,
        country: api.country || null,
        extensions: api.extensions || [],
        // Input/output schema si está disponible
        endpoints: api.endpoints || [],
        // Metadatos adicionales
        metadata: {
          protocol: api.protocol,
          status: api.status,
          dateDetected: api.date_detected,
          dateUpdated: api.date_updated,
          sourceUrl: api.source_url,
          isFreeTier: api.is_free_tier || false
        }
      }));

    res.json({
      marketplace: "Marketplace 402",
      description: "Catálogo chico de APIs LatAm pagables por uso vía x402",
      updated_at: data.updated_at,
      count: resources.length,
      resources
    });
  });

  return router;
}
