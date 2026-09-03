#!/usr/bin/env node
// Enriquece las APIs existentes con taxonomía LatAm y campos de marketplace

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "apis.json");

// Mapeo manual de taxonomía para las APIs existentes
const TAXONOMY_MAP = {
  "apify": { taxonomy: ["web.scraping", "automation"], country: ["US"], endpoint_url: "https://apify.com" },
  "exa-api": { taxonomy: ["search.web", "ai"], country: ["US"], endpoint_url: "https://exa.ai" },
  "browserbase": { taxonomy: ["automation", "browser"], country: ["US"], endpoint_url: "https://x402.browserbase.com" },
  "allium-agenthub": { taxonomy: ["blockchain", "datos.onchain"], country: ["US"], endpoint_url: "https://agents.allium.so" },
  "apihub-weather-api": { taxonomy: ["clima", "weather"], country: null, endpoint_url: "https://apihub.io/marketplace/weather" },
  "x402-tokens": { taxonomy: ["ai", "llm", "inference"], country: ["US"], endpoint_url: "https://x402-tokens.fly.dev" },
  "strale": { taxonomy: ["legal", "compliance", "registro"], country: null, endpoint_url: "https://strale.dev" },
  "fda-intelligence-api": { taxonomy: ["salud", "health", "fda"], country: ["US"] },
  "nutrition-intelligence-api": { taxonomy: ["salud", "health", "nutricion"], country: ["US"] },
  "sanctions-screening-api": { taxonomy: ["legal", "compliance", "aml"], country: null },
  "cve-intelligence-api": { taxonomy: ["seguridad", "security", "vulnerabilities"], country: null },
  "bitrefill": { taxonomy: ["finanzas", "giftcards", "utilidades"], country: null, endpoint_url: "https://www.bitrefill.com" },
  "coingecko": { taxonomy: ["finanzas", "cripto", "precios"], country: null, endpoint_url: "https://www.coingecko.com" },
  "nansen": { taxonomy: ["blockchain", "analytics", "datos.onchain"], country: null, endpoint_url: "https://www.nansen.ai" },
  "2s-io": { taxonomy: ["legal", "datos", "patentes"], country: null, endpoint_url: "https://2s.io" },
  "stableemail": { taxonomy: ["utilidades", "email"], country: null, endpoint_url: "https://stableemail.dev" },
  "x402scan": { taxonomy: ["infraestructura", "explorer"], country: null, endpoint_url: "https://www.x402scan.com" },
  "vibe-springs": { taxonomy: ["clima", "fx", "utilidades"], country: null },
  "venice-ai": { taxonomy: ["ai", "llm", "inference"], country: ["US"], endpoint_url: "https://docs.venice.ai" },
  "edgar-intelligence-api": { taxonomy: ["finanzas", "legal", "sec"], country: ["US"] },
  "mailcheck-api": { taxonomy: ["utilidades", "verificacion", "email"], country: null }
};

function enrichExistingApis() {
  const raw = readFileSync(DATA_FILE, "utf-8");
  const data = JSON.parse(raw);

  console.log(`📊 Enriqueciendo ${data.apis.length} APIs...`);

  let enriched = 0;

  for (const api of data.apis) {
    // Saltar las APIs de AR Agent (ya tienen taxonomía)
    if (api.id.startsWith("ar-agent-")) {
      continue;
    }

    // Si no tiene taxonomía, agregar
    if (!api.taxonomy || api.taxonomy.length === 0) {
      const mapping = TAXONOMY_MAP[api.id];
      if (mapping) {
        api.taxonomy = mapping.taxonomy || [];
        api.country = mapping.country || null;
        if (mapping.endpoint_url && !api.endpoint_url) {
          api.endpoint_url = mapping.endpoint_url;
        }
        enriched++;
        console.log(`   ✅ ${api.name}: agregada taxonomía ${api.taxonomy.join(", ")}`);
      }
    }

    // Asegurar que tiene campos marketplace
    if (!api.callable) {
      api.callable = "dead";
    }
    if (!api.extensions) {
      api.extensions = [];
    }
    if (api.is_free_tier === undefined) {
      api.is_free_tier = false;
    }
  }

  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");

  console.log(`\n✅ Enriquecimiento completo: ${enriched} APIs actualizadas`);
}

enrichExistingApis();
