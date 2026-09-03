#!/usr/bin/env node
// Probe honesto de todas las APIs (y cada endpoint concreto).
// GET/HEAD del URL pagable; parsea PAYMENT-REQUIRED / body x402.
// callable ∈ {mainnet, testnet, dead, incomplete}. No inventa redes.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CALLABLE,
  applyProbeToListing,
  emptyProbeResult,
  isArAgentListing,
  probeTarget,
  resolveProbeTargets,
} from "./lib/probe-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "apis.json");

function parseOnlyPrefix() {
  const flag = process.argv.find((arg) => arg.startsWith("--only="));
  return flag ? flag.slice("--only=".length) : null;
}

function badge(callable) {
  switch (callable) {
    case CALLABLE.MAINNET:
      return "✅ mainnet";
    case CALLABLE.TESTNET:
      return "🧪 testnet";
    case CALLABLE.INCOMPLETE:
      return "⚠️  incomplete";
    default:
      return "❌ dead";
  }
}

async function probeApi(api) {
  const forceTestnet = isArAgentListing(api);
  const targets = resolveProbeTargets(api);

  if (targets.length === 0) {
    const empty = emptyProbeResult({ error: "No URL disponible" });
    return applyProbeToListing(api, [empty]);
  }

  const results = [];
  for (const target of targets) {
    const result = await probeTarget(target, { forceTestnet });
    results.push(result);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return applyProbeToListing(api, results);
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

  console.log(`🔍 Probing ${targets.length} listings${onlyPrefix ? ` (filtro --only=${onlyPrefix})` : ""}...`);

  const counts = { mainnet: 0, testnet: 0, dead: 0, incomplete: 0 };

  for (let i = 0; i < data.apis.length; i++) {
    const api = data.apis[i];
    if (onlyPrefix && !(api.id && api.id.startsWith(onlyPrefix))) continue;

    console.log(`   Probing ${api.name}...`);
    const updated = await probeApi(api);
    data.apis[i] = updated;
    counts[updated.callable] = (counts[updated.callable] || 0) + 1;

    const extra = updated.is_402
      ? `402 ${updated.network || "network?"} ${updated.asset || "asset?"} ${updated.amount || "amount?"} ${updated.pay_to || "payTo?"}`
      : updated.http_status != null
        ? `HTTP ${updated.http_status}`
        : updated.last_probed_at
          ? "unreachable"
          : "no url";
    console.log(`   ${badge(updated.callable)} ${api.name}: ${extra}`);

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  data.updated_at = new Date().toISOString().split("T")[0];
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");

  console.log(`\n✅ Probe completo:`);
  console.log(`   mainnet     ${counts.mainnet}`);
  console.log(`   testnet     ${counts.testnet}`);
  console.log(`   dead        ${counts.dead}`);
  console.log(`   incomplete  ${counts.incomplete}`);
  console.log(`\ndata/apis.json actualizado.`);
}

probe().catch((err) => {
  console.error(err);
  process.exit(1);
});
