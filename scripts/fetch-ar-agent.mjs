#!/usr/bin/env node
// Fetcher para ar-agent-fx.mswitach.workers.dev
// Obtiene endpoints, schemas, precios del worker y genera listings first-party

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slugify } from "./lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "apis.json");

const AR_AGENT_BASE = "https://ar-agent-fx.mswitach.workers.dev";
const PAY_TO = "0xFd576f2fEf750E202ad8DbDfEcEF088f9AA7A30F";
const NETWORK = "Base Sepolia (eip155:84532)";

// Definición manual de endpoints del worker
// (en una impl real, esto vendría de /.well-known/x402.json o /openapi.json)
const AR_AGENT_ENDPOINTS = [
  {
    id: "ar-agent-fx-usd",
    name: "AR Agent FX – Dólar USD oficial",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar estadounidense (USD) oficial del Banco Central de la República Argentina (BCRA).",
    endpoint: "/v1/fx/usd",
    price: "$0.001",
    taxonomy: ["fx.ar.oficial"],
    country: ["AR"]
  },
  {
    id: "ar-agent-fx-casa-blue",
    name: "AR Agent FX – Dólar Blue",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar blue (mercado informal) en Argentina.",
    endpoint: "/v1/fx/blue",
    price: "$0.001",
    taxonomy: ["fx.ar.blue"],
    country: ["AR"]
  },
  {
    id: "ar-agent-fx-casa-bolsa",
    name: "AR Agent FX – Dólar Bolsa (MEP)",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar MEP (Mercado Electrónico de Pagos) en Argentina.",
    endpoint: "/v1/fx/bolsa",
    price: "$0.001",
    taxonomy: ["fx.ar.bolsa", "fx.ar.mep"],
    country: ["AR"]
  },
  {
    id: "ar-agent-fx-casa-ccl",
    name: "AR Agent FX – Dólar CCL",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar Contado con Liquidación (CCL) en Argentina.",
    endpoint: "/v1/fx/contadoconliqui",
    price: "$0.001",
    taxonomy: ["fx.ar.ccl", "fx.ar.contadoconliqui"],
    country: ["AR"]
  },
  {
    id: "ar-agent-fx-casa-cripto",
    name: "AR Agent FX – Dólar Cripto",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar cripto (USDT) en Argentina.",
    endpoint: "/v1/fx/cripto",
    price: "$0.001",
    taxonomy: ["fx.ar.cripto"],
    country: ["AR"]
  },
  {
    id: "ar-agent-fx-casa-mayorista",
    name: "AR Agent FX – Dólar Mayorista",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar mayorista (interbancario) en Argentina.",
    endpoint: "/v1/fx/mayorista",
    price: "$0.001",
    taxonomy: ["fx.ar.mayorista"],
    country: ["AR"]
  },
  {
    id: "ar-agent-fx-casa-tarjeta",
    name: "AR Agent FX – Dólar Tarjeta",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar tarjeta (oficial + impuestos) en Argentina.",
    endpoint: "/v1/fx/tarjeta",
    price: "$0.001",
    taxonomy: ["fx.ar.tarjeta"],
    country: ["AR"]
  },
  {
    id: "ar-agent-bcra-deudores",
    name: "AR Agent – BCRA Deudores",
    category: "Legal / Compliance / Argentina",
    description: "Consulta de deudores del sistema financiero argentino (Central de Deudores del BCRA) por CUIT.",
    endpoint: "/v1/bcra/deudores",
    price: "$0.01",
    taxonomy: ["bcra.deudores", "aml.ar"],
    country: ["AR"]
  },
  {
    id: "ar-agent-afip-cuit",
    name: "AR Agent – AFIP CUIT",
    category: "Legal / Compliance / Argentina",
    description: "Consulta de datos de CUIT/CUIL en AFIP (Administración Federal de Ingresos Públicos de Argentina).",
    endpoint: "/v1/afip/cuit",
    price: "$0.01",
    taxonomy: ["afip.cuit", "registro.ar"],
    country: ["AR"]
  },
  {
    id: "ar-agent-feriados",
    name: "AR Agent – Feriados Argentina",
    category: "Utilidades / Argentina",
    description: "Listado de feriados nacionales en Argentina por año.",
    endpoint: "/v1/feriados/{year}",
    price: "$0.001",
    taxonomy: ["feriados.ar"],
    country: ["AR"]
  },
  {
    id: "ar-agent-infoleg-search",
    name: "AR Agent – InfoLEG Búsqueda",
    category: "Legal / Argentina",
    description: "Búsqueda de normas legales argentinas en InfoLEG (base de datos de legislación argentina).",
    endpoint: "/v1/legal/search",
    price: "$0.005",
    taxonomy: ["infoleg.search"],
    country: ["AR"]
  },
  {
    id: "ar-agent-infoleg-norma",
    name: "AR Agent – InfoLEG Norma",
    category: "Legal / Argentina",
    description: "Obtiene el texto completo de una norma legal argentina por ID de InfoLEG.",
    endpoint: "/v1/legal/norma/{id}",
    price: "$0.01",
    taxonomy: ["infoleg.norma"],
    country: ["AR"]
  }
];

async function fetchArAgent() {
  console.log(`🇦🇷 Fetching ar-agent-fx endpoints...`);

  // Carga datos actuales
  const raw = readFileSync(DATA_FILE, "utf-8");
  const data = JSON.parse(raw);

  // Verifica si el worker está vivo
  let workerLive = false;
  try {
    const healthCheck = await fetch(`${AR_AGENT_BASE}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    workerLive = healthCheck.ok;
    console.log(`   Health check: ${workerLive ? "✅ live" : "❌ down"}`);
  } catch (error) {
    console.log(`   Health check: ❌ error (${error.message})`);
  }

  const today = new Date().toISOString().split("T")[0];
  let added = 0;
  let updated = 0;

  // Agrega/actualiza cada endpoint
  for (const endpoint of AR_AGENT_ENDPOINTS) {
    const existingIndex = data.apis.findIndex(a => a.id === endpoint.id);

    const apiEntry = {
      id: endpoint.id,
      name: endpoint.name,
      category: endpoint.category,
      description: endpoint.description,
      price_display: endpoint.price,
      network: NETWORK,
      protocol: "x402",
      url: AR_AGENT_BASE,
      endpoint_url: AR_AGENT_BASE,
      pay_to: PAY_TO,
      source_url: "https://ar-agent-fx.mswitach.workers.dev",
      date_detected: existingIndex >= 0 ? data.apis[existingIndex].date_detected : today,
      date_updated: today,
      status: "active",
      // Campos marketplace
      callable: workerLive ? "live" : "unchecked",
      last_probed_at: workerLive ? new Date().toISOString() : null,
      http_status: workerLive ? 200 : null,
      taxonomy: endpoint.taxonomy,
      country: endpoint.country,
      extensions: [], // No detectadas aún
      is_free_tier: false,
      endpoints: [
        {
          path: endpoint.endpoint,
          method: "GET",
          description: endpoint.description,
          price: endpoint.price
        }
      ]
    };

    if (existingIndex >= 0) {
      data.apis[existingIndex] = apiEntry;
      updated++;
      console.log(`   ♻️  Actualizado: ${endpoint.name}`);
    } else {
      data.apis.push(apiEntry);
      added++;
      console.log(`   ✅ Agregado: ${endpoint.name}`);
    }
  }

  // Actualiza fecha
  data.updated_at = today;

  // Guarda
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");

  console.log(`\n✅ Fetch completo:`);
  console.log(`   ${added} endpoints agregados`);
  console.log(`   ${updated} endpoints actualizados`);
  console.log(`   Worker status: ${workerLive ? "live" : "down"}`);
  console.log(`\ndata/apis.json actualizado.`);
}

fetchArAgent().catch(console.error);
