// Rutas de API para búsqueda, submit de sellers, y probing

import { Router } from "express";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slugify } from "../../scripts/lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

function loadData() {
  const raw = readFileSync(join(ROOT, "data", "apis.json"), "utf-8");
  return JSON.parse(raw);
}

export function apiRoutes() {
  const router = Router();

  // Búsqueda con facetas
  router.get("/search", (req, res) => {
    const { q, category, country, callable, taxonomy, sort = "name" } = req.query;
    const data = loadData();

    let results = data.apis;

    if (q) {
      const query = q.toLowerCase();
      results = results.filter(api => 
        api.name.toLowerCase().includes(query) || 
        api.description.toLowerCase().includes(query)
      );
    }

    if (category) {
      results = results.filter(api => 
        api.category && api.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (country) {
      const countryUpper = country.toUpperCase();
      results = results.filter(api => 
        api.country && api.country.includes(countryUpper)
      );
    }

    if (callable) {
      results = results.filter(api => api.callable === callable);
    }

    if (taxonomy) {
      results = results.filter(api => 
        api.taxonomy && api.taxonomy.includes(taxonomy)
      );
    }

    // Sorting
    if (sort === "price-asc") {
      results.sort((a, b) => (a.price?.amountMin || Infinity) - (b.price?.amountMin || Infinity));
    } else if (sort === "price-desc") {
      results.sort((a, b) => (b.price?.amountMin || 0) - (a.price?.amountMin || 0));
    } else {
      results.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    // Facets
    const facets = {
      categories: [...new Set(results.map(a => a.category).filter(Boolean))],
      countries: [...new Set(results.flatMap(a => a.country || []))],
      callable_states: [...new Set(results.map(a => a.callable || "dead"))],
      taxonomies: [...new Set(results.flatMap(a => a.taxonomy || []))]
    };

    res.json({
      total: results.length,
      facets,
      results: results.map(api => ({
        id: api.id,
        name: api.name,
        description: api.description,
        category: api.category,
        price: api.price_display,
        network: api.network,
        callable: api.callable || "dead",
        country: api.country,
        taxonomy: api.taxonomy,
        extensions: api.extensions,
        url: api.url,
        endpoint_url: api.endpoint_url
      }))
    });
  });

  // Submit de seller (agrega nueva API para review)
  router.post("/submit", async (req, res) => {
    const { url, name, description, category } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL requerida" });
    }

    // En una implementación completa, aquí haríamos:
    // 1. Fetch a URL/.well-known/x402.json
    // 2. Challenge 402
    // 3. Parsear bazaar extension si existe
    // 4. Agregar a data/apis.json con callable: "dead" hasta el próximo probe
    
    // Por ahora, retornamos éxito con instrucciones
    res.json({
      mensaje: "Envío recibido. En producción, probaríamos el endpoint y lo agregaríamos al catálogo.",
      url_enviada: url,
      siguiente_paso: "El sistema probaría /.well-known/x402.json y haría un challenge 402",
      nota: "MVP: agregar manualmente a data/apis.json; el probe clasifica mainnet|testnet|dead|incomplete"
    });
  });

  // Probe on-demand (verifica un endpoint específico)
  router.post("/probe", async (req, res) => {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Campo 'id' requerido" });
    }

    const data = loadData();
    const api = data.apis.find(a => a.id === id);

    if (!api) {
      return res.status(404).json({ error: "API no encontrada", id });
    }

    // En una implementación completa, haríamos el probe aquí
    // Por ahora retornamos el estado actual
    res.json({
      mensaje: "Probe on-demand no implementado en MVP",
      api: {
        id: api.id,
        name: api.name,
        callable: api.callable || "dead",
        last_probed_at: api.last_probed_at,
        http_status: api.http_status,
        endpoint_url: api.endpoint_url
      },
      nota: "Usar scripts/probe.mjs para probing batch"
    });
  });

  return router;
}
