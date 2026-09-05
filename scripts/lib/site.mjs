// Identidad de producto y formas machine-readable compartidas
// entre el build estático y Express local. El slug del repo sigue
// siendo marketplace-402; el nombre visible es LupaPlaza.
//
// Job de producto (lock): índice de liquidación LatAm — qué endpoint
// URL puede un agente pagar ahora y llevarse datos. No es mapa de
// rieles (LupaRiel) ni directorio de fees de PSP (LupaPago).

export const SITE_NAME = "LupaPlaza";
export const SITE_HEADLINE = "Endpoints cobrables ahora";
export const SITE_DESC =
  "Índice de liquidación LatAm: qué endpoint puede pagar un agente ahora (mainnet, 402 live) y llevarse los datos. No es LupaRiel (rieles) ni LupaPago (fees).";
export const SITE_VERSION = "2.0.0";
export const REPO_URL = "https://github.com/mswitach/marketplace-402";
export const CONTACT_NAME = "Marcelo Switach";
export const LOCAL_ORIGIN = "http://localhost:3402";
export const LOCAL_PORT = 3402;
export const PRODUCTION_ORIGIN = "https://lupaplaza.com";

export const MCP_LIVE_NOTE =
  "El proxy MCP en vivo (POST /mcp/buscar_servicios, /mcp/obtener_servicio, /mcp/llamar_servicio) corre solo en Express local (`npm run dev` :3402). En el host estático no hay pay-through público: el agente paga el endpoint del seller listado en el catálogo.";

export const DISCOVERY_FILTER = "mainnet";

// Vista pública = mainnet + 402 live. Testnet/dead/incomplete pueden
// quedar en data/apis.json (lab) y en /api/apis.json; no entran al HTML.
export function isPublicListing(api) {
  return Boolean(api) && api.callable === DISCOVERY_FILTER && api.is_402 === true;
}

export function publicListings(apis) {
  return (apis || []).filter(isPublicListing);
}

export function toDiscoveryResource(api) {
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    url: api.endpoint_url || api.url,
    category: api.category,
    tags: api.taxonomy || [],
    price: api.price_display,
    network: api.network,
    asset: api.asset || null,
    amount: api.amount || null,
    payTo: api.pay_to,
    callable: api.callable || "dead",
    is_402: Boolean(api.is_402),
    http_status: api.http_status ?? null,
    lastProbed: api.last_probed_at || null,
    country: api.country || null,
    extensions: api.extensions || [],
    endpoints: api.endpoints || [],
    metadata: {
      protocol: api.protocol,
      status: api.status,
      dateDetected: api.date_detected,
      dateUpdated: api.date_updated,
      sourceUrl: api.source_url,
      isFreeTier: api.is_free_tier || false,
    },
  };
}

export function discoveryCatalog(data, apis) {
  // Inventario de agentes: solo listings cobrables ahora (mainnet + 402 live).
  // Testnet / dead / incomplete viven en /api/apis.json (lab).
  const resources = publicListings(apis || data.apis)
    .filter((api) => api.endpoint_url)
    .map(toDiscoveryResource);

  return {
    marketplace: SITE_NAME,
    description:
      "Índice de liquidación: endpoints x402 cobrables ahora (mainnet, 402 live). No incluye testnet, dead, incomplete, ni dumps globales.",
    filter: DISCOVERY_FILTER,
    inclusion: "mainnet + live 402",
    updated_at: data.updated_at || data.updatedAt,
    count: resources.length,
    resources,
  };
}

export function wellKnownDocument(origin, { staticHost = false } = {}) {
  const discovery = {
    resources: `${origin}/discovery/resources`,
    resources_json: `${origin}/discovery/resources.json`,
    catalog: `${origin}/api/apis.json`,
    openapi: `${origin}/openapi.json`,
    llms: `${origin}/llms.txt`,
  };
  if (!staticHost) {
    discovery.search = `${origin}/api/search`;
  }

  return {
    name: SITE_NAME,
    description:
      "Índice de liquidación LatAm: /discovery/resources lista solo endpoints cobrables ahora (mainnet, 402 live). No es LupaRiel (mapa de rieles) ni LupaPago (fees de PSP).",
    version: SITE_VERSION,
    protocol: "x402",
    marketplace: true,
    inventory: "mainnet",
    note: "Los agentes descubren endpoints cobrables en /discovery/resources (mainnet + 402 live). /api/apis.json es el dump de lab (incluye testnet/dead/incomplete). El HTML público no lista esos estados. Testnet no es inventario settleable.",
    discovery,
    mcp: staticHost
      ? {
          manifest: `${origin}/mcp/manifest.json`,
          language: "es",
          live_proxy: "local-only",
          local: `${LOCAL_ORIGIN}/mcp`,
          note: MCP_LIVE_NOTE,
        }
      : {
          manifest: `${origin}/mcp`,
          language: "es",
        },
    regions: ["AR", "MX", "CO", "BR", "CL", "PE"],
    contact: {
      name: CONTACT_NAME,
      url: REPO_URL,
    },
  };
}

export function mcpTools() {
  return [
    {
      name: "buscar_servicios",
      description: "Busca APIs x402 por categoría, país, taxonomía o texto libre. Gratis.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto de búsqueda (nombre o descripción)" },
          categoria: { type: "string", description: "Categoría (ej: 'Finanzas', 'Legal')" },
          pais: { type: "string", description: "Código ISO de país (AR, MX, CO, BR, CL, PE)" },
          taxonomia: {
            type: "string",
            description: "Tag de taxonomía LatAm (ej: 'fx.ar.casa', 'bcra.deudores')",
          },
          callable: {
            type: "string",
            enum: ["mainnet", "testnet", "dead", "incomplete"],
            description:
              "mainnet = 402 live en red mainnet (lo que publica el índice). testnet/dead/incomplete son lab (/api/apis.json), no el listado público.",
          },
        },
      },
    },
    {
      name: "obtener_servicio",
      description: "Obtiene detalles completos de una API por su ID. Gratis.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID del servicio" },
        },
        required: ["id"],
      },
    },
    {
      name: "llamar_servicio",
      description:
        "En Express local, devuelve instrucciones de pass-through x402. En el host estático no hay proxy: el agente paga el endpoint del seller.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID del servicio" },
          endpoint: { type: "string", description: "Path del endpoint (ej: '/v1/fx/usd')" },
          method: { type: "string", enum: ["GET", "POST"], default: "GET" },
          body: { type: "object", description: "Cuerpo de la request (solo POST)" },
        },
        required: ["id", "endpoint"],
      },
    },
  ];
}

export function mcpManifestDocument(origin, { staticHost = false } = {}) {
  const tools = mcpTools();
  return {
    name: `${SITE_NAME} MCP`,
    description:
      "Herramientas MCP en español. En el host estático los agentes descubren endpoints cobrables (mainnet + 402 live) vía /discovery/resources. El HTML público no lista testnet/dead.",
    version: SITE_VERSION,
    language: "es",
    tools: staticHost
      ? tools.map((tool) => ({
          ...tool,
          how_to_call:
            tool.name === "llamar_servicio"
              ? "No hay MCP pay-through público. Tomá `url`/`payTo`/`endpoints` de /discovery/resources (solo mainnet) y pagá el seller directo (p. ej. x402-buyer). Testnet no es inventario de producción. En local, POST /mcp/llamar_servicio solo devuelve instrucciones."
              : tool.name === "buscar_servicios"
                ? `Agentes: ${origin}/discovery/resources es mainnet-only. El dump completo (testnet/dead/incomplete) está en ${origin}/api/apis.json. En local: POST ${LOCAL_ORIGIN}/mcp/${tool.name}.`
                : `En el host estático: filtrá ${origin}/discovery/resources (mainnet) o ${origin}/api/apis.json (todas las filas, con callable honesto). En local: POST ${LOCAL_ORIGIN}/mcp/${tool.name}.`,
        }))
      : tools,
    ...(staticHost
      ? {
          live_proxy: "local-only",
          local: `${LOCAL_ORIGIN}/mcp`,
          catalog: {
            resources: `${origin}/discovery/resources`,
            resources_json: `${origin}/discovery/resources.json`,
            apis: `${origin}/api/apis.json`,
          },
          note: MCP_LIVE_NOTE,
        }
      : {}),
  };
}
