// Servidor MCP en español
// Inspirado en FiatDock: buscar_servicios (gratis), obtener_servicio (gratis), llamar_servicio (pass-through 402)

import { Router } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mcpManifestDocument } from "../../scripts/lib/site.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

function loadData() {
  const raw = readFileSync(join(ROOT, "data", "apis.json"), "utf-8");
  return JSON.parse(raw);
}

export function mcpRoutes() {
  const router = Router();

  // MCP manifest (misma forma que public/mcp/manifest.json, sin el disclaimer estático)
  const sendManifest = (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    res.json(mcpManifestDocument(origin, { staticHost: false }));
  };
  router.get("/", sendManifest);
  router.get("/manifest.json", sendManifest);

  // buscar_servicios
  router.post("/buscar_servicios", (req, res) => {
    const { query, categoria, pais, taxonomia, callable } = req.body;
    const data = loadData();

    let results = data.apis;

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(api => 
        api.name.toLowerCase().includes(q) || 
        api.description.toLowerCase().includes(q)
      );
    }

    if (categoria) {
      results = results.filter(api => 
        api.category && api.category.toLowerCase().includes(categoria.toLowerCase())
      );
    }

    if (pais) {
      results = results.filter(api => 
        api.country && api.country.includes(pais.toUpperCase())
      );
    }

    if (taxonomia) {
      results = results.filter(api => 
        api.taxonomy && api.taxonomy.some(t => t === taxonomia)
      );
    }

    if (callable) {
      results = results.filter(api => api.callable === callable);
    }

    res.json({
      total: results.length,
      servicios: results.map(api => ({
        id: api.id,
        nombre: api.name,
        descripcion: api.description,
        categoria: api.category,
        precio: api.price_display,
        red: api.network,
        callable: api.callable || "unchecked",
        pais: api.country,
        taxonomia: api.taxonomy,
        url: api.endpoint_url || api.url
      }))
    });
  });

  // obtener_servicio
  router.post("/obtener_servicio", (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Campo 'id' requerido" });
    }

    const data = loadData();
    const api = data.apis.find(a => a.id === id);

    if (!api) {
      return res.status(404).json({ error: "Servicio no encontrado", id });
    }

    res.json({
      id: api.id,
      nombre: api.name,
      descripcion: api.description,
      categoria: api.category,
      precio: api.price_display,
      red: api.network,
      protocolo: api.protocol,
      pay_to: api.pay_to,
      endpoint_url: api.endpoint_url,
      callable: api.callable || "unchecked",
      last_probed_at: api.last_probed_at,
      http_status: api.http_status,
      pais: api.country,
      taxonomia: api.taxonomy,
      extensiones: api.extensions,
      endpoints: api.endpoints,
      fecha_detectada: api.date_detected,
      fecha_actualizada: api.date_updated,
      url_sitio: api.url,
      fuente: api.source_url,
      tier_gratis: api.is_free_tier || false
    });
  });

  // llamar_servicio (placeholder - requiere cliente x402)
  router.post("/llamar_servicio", async (req, res) => {
    const { id, endpoint, method = "GET", body } = req.body;

    if (!id || !endpoint) {
      return res.status(400).json({ 
        error: "Campos 'id' y 'endpoint' requeridos" 
      });
    }

    const data = loadData();
    const api = data.apis.find(a => a.id === id);

    if (!api || !api.endpoint_url) {
      return res.status(404).json({ 
        error: "Servicio no encontrado o sin endpoint_url",
        id 
      });
    }

    // En una implementación real, aquí haríamos el pass-through x402
    // Por ahora devolvemos instrucciones para el agente
    res.json({
      mensaje: "Pass-through x402 no implementado en este MVP",
      instrucciones: {
        url: api.endpoint_url + endpoint,
        metodo: method,
        pay_to: api.pay_to,
        red: api.network,
        precio_estimado: api.price_display,
        nota: "El agente debe hacer la llamada x402 directamente usando su cliente (ej: x402-buyer)"
      },
      api: {
        id: api.id,
        nombre: api.name,
        endpoint_url: api.endpoint_url
      }
    });
  });

  return router;
}
