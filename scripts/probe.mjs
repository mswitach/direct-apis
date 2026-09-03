#!/usr/bin/env node
// Probe batch de todas las APIs con endpoint_url definido
// Verifica /.well-known/x402.json y hace un challenge 402 simple

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveProbeUrl } from "./lib/probe-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "apis.json");

function parseOnlyPrefix() {
  const flag = process.argv.find((arg) => arg.startsWith("--only="));
  return flag ? flag.slice("--only=".length) : null;
}

async function probeEndpoint(api) {
  const probeUrl = resolveProbeUrl(api);
  if (!probeUrl) {
    return { callable: "unchecked", http_status: null, error: "No URL disponible" };
  }

  try {
    // GET al path concreto si existe (no el root): 402 o 200 = live.
    const response = await fetch(probeUrl, {
      method: "GET",
      headers: { "User-Agent": "LupaPlaza-Probe/2.0" },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    const status = response.status;

    // 402 = live (requiere pago)
    if (status === 402) {
      return { callable: "live", http_status: 402, error: null };
    }

    // 200 = live (tier gratis o sin paywall)
    if (status === 200) {
      return { callable: "live", http_status: 200, error: null };
    }

    // Otros códigos 2xx/3xx
    if (status >= 200 && status < 400) {
      return { callable: "live", http_status: status, error: null };
    }

    // 4xx/5xx = dead
    return { callable: "dead", http_status: status, error: `HTTP ${status}` };

  } catch (error) {
    // Network error, timeout, etc = dead
    return { 
      callable: "dead", 
      http_status: null, 
      error: error.message 
    };
  }
}

async function probeWellKnown(baseUrl) {
  try {
    const url = new URL("/.well-known/x402.json", baseUrl).toString();
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch {
    // Well-known no disponible
  }
  return null;
}

async function probe() {
  const raw = readFileSync(DATA_FILE, "utf-8");
  const data = JSON.parse(raw);
  const onlyPrefix = parseOnlyPrefix();
  const targets = onlyPrefix
    ? data.apis.filter((api) => api.id && api.id.startsWith(onlyPrefix))
    : data.apis;

  if (onlyPrefix && targets.length === 0) {
    console.error(`No hay APIs con id que empiece por "${onlyPrefix}".`);
    process.exit(1);
  }

  console.log(`🔍 Probing ${targets.length} APIs${onlyPrefix ? ` (filtro --only=${onlyPrefix})` : ""}...`);

  let probed = 0;
  let live = 0;
  let dead = 0;
  let unchecked = 0;

  for (const api of targets) {
    if (!api.endpoint_url && !api.url) {
      console.log(`⏭️  ${api.name}: sin URL, saltando`);
      api.callable = "unchecked";
      unchecked++;
      continue;
    }

    console.log(`   Probing ${api.name}...`);
    
    // Probe endpoint
    const result = await probeEndpoint(api);
    api.callable = result.callable;
    api.http_status = result.http_status;
    api.last_probed_at = new Date().toISOString();
    
    if (result.callable === "live") {
      console.log(`   ✅ ${api.name}: live (HTTP ${result.http_status})`);
      live++;
    } else if (result.callable === "dead") {
      console.log(`   ❌ ${api.name}: dead (${result.error})`);
      dead++;
    } else {
      console.log(`   ⏭️  ${api.name}: unchecked`);
      unchecked++;
    }

    // Probe well-known (opcional, no bloquea)
    if (api.url || api.endpoint_url) {
      const wellKnown = await probeWellKnown(api.endpoint_url || api.url);
      if (wellKnown) {
        console.log(`      📄 Well-known encontrado: ${wellKnown.name || "sin nombre"}`);
        // Podríamos actualizar api.endpoints, api.extensions, etc. desde well-known
      }
    }

    probed++;
    
    // Rate limit: espera 500ms entre probes
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Actualiza updated_at
  data.updated_at = new Date().toISOString().split("T")[0];

  // Guarda
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");

  console.log(`\n✅ Probe completo:`);
  console.log(`   ${probed} probed`);
  console.log(`   ${live} live`);
  console.log(`   ${dead} dead`);
  console.log(`   ${unchecked} unchecked`);
  console.log(`\ndata/apis.json actualizado con callable status.`);
}

probe().catch(console.error);
