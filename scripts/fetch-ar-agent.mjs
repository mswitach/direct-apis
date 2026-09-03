#!/usr/bin/env node
// Fetcher para ar-agent-fx.mswitach.workers.dev
// Obtiene endpoints, schemas, precios del worker y genera listings first-party.
// Los paths siguen el well-known vivo del worker (no los paths viejos /v1/fx/blue).
// Cada listing se probea en su path concreto. Sepolia = testnet, nunca mainnet.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CALLABLE,
  applyProbeToListing,
  fillPathTemplate,
  probeTarget,
} from "./lib/probe-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "apis.json");

const AR_AGENT_BASE = "https://ar-agent-fx.mswitach.workers.dev";
const PAY_TO = "0xFd576f2fEf750E202ad8DbDfEcEF088f9AA7A30F";

// 12 listings first-party (21 + 12 = 33). No se agrega cheques-rechazados
// ni se inventa volumen: mismos IDs, paths alineados al well-known actual.
const AR_AGENT_ENDPOINTS = [
  {
    id: "ar-agent-fx-usd",
    name: "AR Agent FX – Dólar USD oficial",
    category: "Finanzas / Tipo de cambio / Argentina",
    description:
      "Cotización USD/ARS oficial (BCRA) vía /v1/fx/usd/oficial. El worker también expone el dump multi-casa en /v1/fx/usd.",
    endpoint: "/v1/fx/usd/oficial",
    price: "$0.001",
    taxonomy: ["fx.ar.oficial"],
    country: ["AR"],
  },
  {
    id: "ar-agent-fx-casa-blue",
    name: "AR Agent FX – Dólar Blue",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar blue (mercado informal) en Argentina.",
    endpoint: "/v1/fx/usd/blue",
    price: "$0.001",
    taxonomy: ["fx.ar.blue"],
    country: ["AR"],
  },
  {
    id: "ar-agent-fx-casa-bolsa",
    name: "AR Agent FX – Dólar Bolsa (MEP)",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar MEP (Mercado Electrónico de Pagos) en Argentina.",
    endpoint: "/v1/fx/usd/bolsa",
    price: "$0.001",
    taxonomy: ["fx.ar.bolsa", "fx.ar.mep"],
    country: ["AR"],
  },
  {
    id: "ar-agent-fx-casa-ccl",
    name: "AR Agent FX – Dólar CCL",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar Contado con Liquidación (CCL) en Argentina.",
    endpoint: "/v1/fx/usd/contadoconliqui",
    price: "$0.001",
    taxonomy: ["fx.ar.ccl", "fx.ar.contadoconliqui"],
    country: ["AR"],
  },
  {
    id: "ar-agent-fx-casa-cripto",
    name: "AR Agent FX – Dólar Cripto",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar cripto (USDT) en Argentina.",
    endpoint: "/v1/fx/usd/cripto",
    price: "$0.001",
    taxonomy: ["fx.ar.cripto"],
    country: ["AR"],
  },
  {
    id: "ar-agent-fx-casa-mayorista",
    name: "AR Agent FX – Dólar Mayorista",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar mayorista (interbancario) en Argentina.",
    endpoint: "/v1/fx/usd/mayorista",
    price: "$0.001",
    taxonomy: ["fx.ar.mayorista"],
    country: ["AR"],
  },
  {
    id: "ar-agent-fx-casa-tarjeta",
    name: "AR Agent FX – Dólar Tarjeta",
    category: "Finanzas / Tipo de cambio / Argentina",
    description: "Cotización del dólar tarjeta (oficial + impuestos) en Argentina.",
    endpoint: "/v1/fx/usd/tarjeta",
    price: "$0.001",
    taxonomy: ["fx.ar.tarjeta"],
    country: ["AR"],
  },
  {
    id: "ar-agent-bcra-deudores",
    name: "AR Agent – BCRA Deudores",
    category: "Legal / Compliance / Argentina",
    description:
      "Consulta de deudores del sistema financiero argentino (Central de Deudores del BCRA) por CUIT.",
    endpoint: "/v1/bcra/deudores/{cuit}",
    price: "$0.01",
    taxonomy: ["bcra.deudores", "aml.ar"],
    country: ["AR"],
  },
  {
    id: "ar-agent-afip-cuit",
    name: "AR Agent – CUIT",
    category: "Legal / Compliance / Argentina",
    description:
      "Validación de CUIT (módulo 11) más denominación pública BCRA. No es padrón AFIP completo.",
    endpoint: "/v1/cuit/{cuit}",
    price: "$0.01",
    taxonomy: ["afip.cuit", "registro.ar"],
    country: ["AR"],
  },
  {
    id: "ar-agent-feriados",
    name: "AR Agent – Feriados Argentina",
    category: "Utilidades / Argentina",
    description: "Listado de feriados nacionales en Argentina por año.",
    endpoint: "/v1/feriados/{year}",
    price: "$0.001",
    taxonomy: ["feriados.ar"],
    country: ["AR"],
  },
  {
    id: "ar-agent-infoleg-search",
    name: "AR Agent – InfoLEG Búsqueda",
    category: "Legal / Argentina",
    description:
      "Búsqueda de normas legales argentinas en InfoLEG (scrape HTML; no es API oficial JSON).",
    endpoint: "/v1/legal/search",
    price: "$0.005",
    taxonomy: ["infoleg.search"],
    country: ["AR"],
  },
  {
    id: "ar-agent-infoleg-norma",
    name: "AR Agent – InfoLEG Norma",
    category: "Legal / Argentina",
    description: "Obtiene el texto completo de una norma legal argentina por ID de InfoLEG.",
    endpoint: "/v1/legal/norma/{id}",
    price: "$0.01",
    taxonomy: ["infoleg.norma"],
    country: ["AR"],
  },
];

async function probePath(path) {
  const url = `${AR_AGENT_BASE}${fillPathTemplate(path)}`;
  return probeTarget({ url, path, method: "GET" }, { forceTestnet: true });
}

async function fetchArAgent() {
  console.log("🇦🇷 Fetching ar-agent-fx endpoints...");

  const raw = readFileSync(DATA_FILE, "utf-8");
  const data = JSON.parse(raw);

  let workerLive = false;
  try {
    const healthCheck = await fetch(`${AR_AGENT_BASE}/health`, {
      headers: { "User-Agent": "LupaPlaza-Probe/2.0" },
      signal: AbortSignal.timeout(5000),
    });
    workerLive = healthCheck.ok;
    console.log(`   Health check: ${workerLive ? "✅ live" : `❌ HTTP ${healthCheck.status}`}`);
  } catch (error) {
    console.log(`   Health check: ❌ error (${error.message})`);
  }

  const today = new Date().toISOString().split("T")[0];
  let added = 0;
  let updated = 0;
  let live = 0;
  let dead = 0;

  for (const endpoint of AR_AGENT_ENDPOINTS) {
    const existingIndex = data.apis.findIndex((a) => a.id === endpoint.id);
    const probe = await probePath(endpoint.endpoint);
    const now = new Date().toISOString();

    if (probe.callable === CALLABLE.TESTNET) {
      console.log(`   🧪 ${endpoint.name}: testnet (HTTP ${probe.http_status}) ${probe.url}`);
      live++;
    } else if (probe.callable === CALLABLE.INCOMPLETE) {
      console.log(`   ⚠️  ${endpoint.name}: incomplete (${probe.error || "402 sin campos"}) ${probe.url}`);
      dead++;
    } else {
      console.log(`   ❌ ${endpoint.name}: ${probe.callable} (${probe.error}) ${probe.url}`);
      dead++;
    }

    const seed = {
      id: endpoint.id,
      name: endpoint.name,
      category: endpoint.category,
      description: endpoint.description,
      price_display: endpoint.price,
      network: null,
      protocol: "x402",
      url: AR_AGENT_BASE,
      endpoint_url: AR_AGENT_BASE,
      pay_to: PAY_TO,
      source_url: AR_AGENT_BASE,
      date_detected: existingIndex >= 0 ? data.apis[existingIndex].date_detected : today,
      date_updated: today,
      status: "active",
      taxonomy: endpoint.taxonomy,
      country: endpoint.country,
      extensions: [],
      is_free_tier: false,
      endpoints: [
        {
          path: endpoint.endpoint,
          method: "GET",
          description: endpoint.description,
          price: endpoint.price,
        },
      ],
    };
    const apiEntry = applyProbeToListing(seed, [{ ...probe, probed_at: probe.probed_at || now }]);
    // AR first-party: Sepolia nunca es mainnet aunque el parser se confunda.
    if (apiEntry.callable === CALLABLE.MAINNET) apiEntry.callable = CALLABLE.TESTNET;

    if (existingIndex >= 0) {
      data.apis[existingIndex] = apiEntry;
      updated++;
    } else {
      data.apis.push(apiEntry);
      added++;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  data.updated_at = today;
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");

  console.log("\n✅ Fetch completo:");
  console.log(`   ${added} endpoints agregados`);
  console.log(`   ${updated} endpoints actualizados`);
  console.log(`   Worker /health: ${workerLive ? "live" : "down"}`);
  console.log(`   Paths: ${live} testnet, ${dead} dead/incomplete`);
  console.log("\ndata/apis.json actualizado.");
}

fetchArAgent().catch((err) => {
  console.error(err);
  process.exit(1);
});
