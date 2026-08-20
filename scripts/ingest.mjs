#!/usr/bin/env node
// Toma el archivo de research diario (tabla markdown, mismas columnas que
// siempre: # | Nombre | Categoría | Descripción | Precio | Red | URL | Fecha
// detectada | Fuente) y lo mergea contra data/apis.json por id (slug del
// nombre). Entradas nuevas se agregan; entradas existentes actualizan sus
// campos pero conservan su date_detected original.
//
// Uso: node scripts/ingest.mjs ruta/al/archivo-del-dia.md

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slugify } from "./lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "data", "apis.json");

function unescapeMarkdown(text) {
  // El research diario a veces llega con markdown escapado (\# \* \| etc.),
  // artefacto de cómo algunas herramientas devuelven el contenido de Drive.
  return text.replace(/\\([#*_[\]()>.|-])/g, "$1");
}

function parseTable(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const rows = [];
  let inTable = false;

  for (const line of lines) {
    if (!line.startsWith("|")) {
      if (inTable) break; // la tabla de APIs es un bloque contiguo
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

    if (cells[0] === "#") {
      inTable = true;
      continue; // header
    }
    if (!inTable) continue;
    if (/^-+$/.test(cells[0].replace(/[^-]/g, "-"))) continue; // separador ---|---

    if (cells.length >= 9 && /^\d+$/.test(cells[0])) {
      rows.push({
        name: cells[1],
        category: cells[2],
        description: cells[3],
        price_display: cells[4],
        network: cells[5] === "—" || cells[5] === "-" ? null : cells[5],
        url: cells[6] === "—" || cells[6] === "-" ? null : cells[6],
        date_detected: cells[7],
        source_url: cells[8],
      });
    }
  }
  return rows;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: node scripts/ingest.mjs ruta/al/archivo-del-dia.md");
    process.exit(1);
  }

  const raw = unescapeMarkdown(readFileSync(filePath, "utf-8"));
  const rows = parseTable(raw);
  if (rows.length === 0) {
    console.error("No se encontró ninguna fila de tabla en el archivo. ¿Cambió el formato?");
    process.exit(1);
  }

  const db = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  const byId = new Map(db.apis.map((a) => [a.id, a]));

  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  let updated = 0;
  const changedNames = [];

  for (const row of rows) {
    const id = slugify(row.name);
    const existing = byId.get(id);

    if (!existing) {
      byId.set(id, {
        id,
        name: row.name,
        category: row.category,
        description: row.description,
        price_display: row.price_display,
        network: row.network,
        protocol: "x402",
        url: row.url,
        source_url: row.source_url,
        date_detected: row.date_detected || today,
        date_updated: today,
        status: "active",
      });
      added++;
      changedNames.push(`+ ${row.name}`);
      continue;
    }

    const fieldsChanged =
      existing.category !== row.category ||
      existing.description !== row.description ||
      existing.price_display !== row.price_display ||
      existing.network !== row.network ||
      existing.url !== row.url;

    if (fieldsChanged) {
      Object.assign(existing, {
        category: row.category,
        description: row.description,
        price_display: row.price_display,
        network: row.network,
        url: row.url,
        source_url: row.source_url,
        date_updated: today,
      });
      updated++;
      changedNames.push(`~ ${row.name}`);
    }
  }

  const merged = {
    updated_at: today,
    apis: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es")),
  };

  writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2) + "\n");

  console.log(`Ingest OK: ${added} nuevas, ${updated} actualizadas, ${merged.apis.length} en total.`);
  if (changedNames.length) console.log(changedNames.join("\n"));
}

main();
