#!/usr/bin/env node
// Genera el sitio estático completo (público para humanos y agentes) a partir
// de data/apis.json. No tiene dependencias externas: corre con "node scripts/build.mjs".
//
// Todo lo que sale de acá (HTML, JSON, llms.txt, sitemap) se deriva del mismo
// archivo fuente, así que nunca puede desincronizarse entre sí.

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slugify, categoryTags, parsePrice, isRecent, escapeHtml } from "./lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public");
const SITE_NAME = "x402 Index";
const SITE_DESC = "Índice de APIs y fuentes de datos pagables por uso vía el protocolo x402, para personas y para agentes.";
const SITE_URL = "https://mswitach.github.io/direct-apis";
// GitHub Pages sirve este repo como "project site" bajo /direct-apis/, no en
// la raíz del dominio — todo link interno tiene que llevar este prefijo.
const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/$/, "");

function loadData() {
  const raw = readFileSync(join(ROOT, "data", "apis.json"), "utf-8");
  const data = JSON.parse(raw);
  const apis = data.apis
    .map((api) => ({
      ...api,
      slug: api.id || slugify(api.name),
      tags: categoryTags(api.category),
      price: parsePrice(api.price_display),
      isNew: isRecent(api.date_detected, data.updated_at, 1),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { updatedAt: data.updated_at, apis };
}

function layout({ title, description, canonical, body, jsonLd }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><text y=%2213%22 font-size=%2214%22>🧾</text></svg>">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${BASE_PATH}/styles.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Spectral:wght@500;600;700&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="alternate" type="application/json" href="${BASE_PATH}/api/apis.json" title="${SITE_NAME} — dataset JSON">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
</head>
<body>
${body}
</body>
</html>`;
}

function siteHeader(active) {
  return `<header class="topbar">
  <a class="brand" href="${BASE_PATH}/">
    <span class="brand-mark">402</span>
    <span class="brand-name">${SITE_NAME}</span>
  </a>
  <nav class="topnav">
    <a href="${BASE_PATH}/" class="${active === "home" ? "is-active" : ""}">Listado</a>
    <a href="${BASE_PATH}/api/apis.json">JSON</a>
    <a href="${BASE_PATH}/llms.txt">llms.txt</a>
    <a href="https://github.com/mswitach/direct-apis">Repo</a>
  </nav>
</header>`;
}

function priceLabel(api) {
  return escapeHtml(api.price_display || "—");
}

function apiCard(api) {
  const tagsHtml = api.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
  return `<article class="card"
  data-name="${escapeHtml(api.name.toLowerCase())}"
  data-desc="${escapeHtml(api.description.toLowerCase())}"
  data-tags="${escapeHtml(api.tags.join("|").toLowerCase())}"
  data-network="${escapeHtml((api.network || "").toLowerCase())}"
  data-price-min="${api.price.amountMin ?? ""}"
  data-new="${api.isNew ? "1" : "0"}">
  <div class="card-top">
    <h3><a href="${BASE_PATH}/apis/${api.slug}/">${escapeHtml(api.name)}</a></h3>
    ${api.isNew ? '<span class="badge-new">nueva hoy</span>' : ""}
  </div>
  <div class="card-tags">${tagsHtml}</div>
  <p class="card-desc">${escapeHtml(api.description)}</p>
  <div class="card-foot">
    <span class="price mono">${priceLabel(api)}</span>
    <span class="network">${escapeHtml(api.network || "red no especificada")}</span>
  </div>
</article>`;
}

function renderIndex({ updatedAt, apis }) {
  const allTags = [...new Set(apis.flatMap((a) => a.tags))].sort((a, b) => a.localeCompare(b, "es"));
  const allNetworks = [...new Set(apis.map((a) => a.network).filter(Boolean))].sort();

  const tagChips = allTags
    .map((t) => `<button type="button" class="filter-chip" data-filter-tag="${escapeHtml(t.toLowerCase())}">${escapeHtml(t)}</button>`)
    .join("");

  const networkOptions = allNetworks
    .map((n) => `<option value="${escapeHtml(n.toLowerCase())}">${escapeHtml(n)}</option>`)
    .join("");

  const cards = apis.map(apiCard).join("\n");

  const body = `${siteHeader("home")}
<main class="page">
  <section class="hero">
    <p class="eyebrow">Economía agéntica · protocolo x402</p>
    <h1>APIs pagables por uso, para personas y para agentes</h1>
    <p class="dek">${SITE_DESC} Sin planes, sin suscripciones: se paga por request, en cripto, sobre HTTP 402.</p>
    <dl class="stats">
      <div><dt>APIs relevadas</dt><dd class="mono">${apis.length}</dd></div>
      <div><dt>Categorías</dt><dd class="mono">${allTags.length}</dd></div>
      <div><dt>Última actualización</dt><dd class="mono">${updatedAt}</dd></div>
    </dl>
  </section>

  <section class="filters" aria-label="Filtros">
    <input type="search" id="q" class="search" placeholder="Buscar por nombre o descripción…" aria-label="Buscar">
    <div class="filter-row">
      <select id="network-filter" aria-label="Filtrar por red de pago">
        <option value="">Toda red de pago</option>
        ${networkOptions}
      </select>
      <select id="sort" aria-label="Ordenar">
        <option value="name">Ordenar: nombre (A–Z)</option>
        <option value="price-asc">Ordenar: precio (menor primero)</option>
        <option value="price-desc">Ordenar: precio (mayor primero)</option>
        <option value="new">Ordenar: más nuevas primero</option>
      </select>
      <button type="button" id="clear-filters" class="btn-ghost">Limpiar</button>
    </div>
    <div class="chip-row" id="tag-filters">${tagChips}</div>
  </section>

  <p class="result-count" id="result-count" aria-live="polite"></p>

  <section class="grid" id="grid">
    ${cards}
  </section>

  <p class="empty-state" id="empty-state" hidden>No hay APIs que matcheen esos filtros.</p>
</main>
<footer class="sitefoot">
  <p>Datos abiertos, sin API key: <a href="${BASE_PATH}/api/apis.json">apis.json</a> · <a href="${BASE_PATH}/api/apis.ndjson">apis.ndjson</a> · <a href="${BASE_PATH}/llms.txt">llms.txt</a></p>
  <p>Relevamiento diario, curado a mano. Última actualización: <span class="mono">${updatedAt}</span>.</p>
</footer>
<script src="${BASE_PATH}/app.js"></script>`;

  return layout({
    title: `${SITE_NAME} — APIs pagables por uso vía x402`,
    description: SITE_DESC,
    canonical: `${SITE_URL}/`,
    body,
  });
}

function renderDetail(api) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: api.name,
    description: api.description,
    category: api.category,
    url: api.url || undefined,
    offers: {
      "@type": "Offer",
      price: api.price.amountMin ?? undefined,
      priceCurrency: api.price.amountMin ? "USD" : undefined,
      description: api.price_display,
    },
  };

  const body = `${siteHeader("detail")}
<main class="page page-detail">
  <nav class="breadcrumbs"><a href="${BASE_PATH}/">Listado</a> <span aria-hidden="true">/</span> ${escapeHtml(api.name)}</nav>
  <article class="detail">
    <div class="card-tags">${api.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>
    <h1>${escapeHtml(api.name)}</h1>
    <p class="detail-desc">${escapeHtml(api.description)}</p>

    <dl class="ledger">
      <div class="ledger-row"><dt>Precio</dt><dd class="mono">${priceLabel(api)}</dd></div>
      <div class="ledger-row"><dt>Red de pago</dt><dd>${escapeHtml(api.network || "no especificada")}</dd></div>
      <div class="ledger-row"><dt>Protocolo</dt><dd class="mono">${escapeHtml(api.protocol)}</dd></div>
      <div class="ledger-row"><dt>Categoría</dt><dd>${escapeHtml(api.category)}</dd></div>
      <div class="ledger-row"><dt>Detectada</dt><dd class="mono">${escapeHtml(api.date_detected)}</dd></div>
      <div class="ledger-row"><dt>Actualizada</dt><dd class="mono">${escapeHtml(api.date_updated)}</dd></div>
    </dl>

    <div class="detail-links">
      ${api.url ? `<a class="btn-primary" href="${escapeHtml(api.url)}">Sitio oficial ↗</a>` : ""}
      ${api.source_url ? `<a class="btn-ghost" href="${escapeHtml(api.source_url.split(" ; ")[0])}">Fuente ↗</a>` : ""}
      <a class="btn-ghost" href="${BASE_PATH}/api/apis.json#${api.slug}">Ver en JSON</a>
    </div>
  </article>
</main>
<footer class="sitefoot">
  <p><a href="${BASE_PATH}/">← Volver al listado completo</a></p>
</footer>`;

  return layout({
    title: `${api.name} — ${SITE_NAME}`,
    description: api.description,
    canonical: `${SITE_URL}/apis/${api.slug}/`,
    body,
    jsonLd,
  });
}

function renderLlmsTxt({ updatedAt, apis }) {
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESC}`,
    "",
    `Última actualización de datos: ${updatedAt}. Total de APIs: ${apis.length}.`,
    "",
    "Este sitio está pensado para ser leído tanto por personas como por agentes/LLMs.",
    "El HTML de cada página ya contiene el listado completo (sin necesidad de ejecutar JS),",
    "y además exponemos los mismos datos en formatos estructurados:",
    "",
    "## Datos",
    "",
    `- [Dataset completo en JSON](${SITE_URL}/api/apis.json): array de objetos, un objeto por API, ver el schema en el propio repo (data/apis.json).`,
    `- [Dataset en NDJSON](${SITE_URL}/api/apis.ndjson): un objeto JSON por línea, útil para procesar en streaming.`,
    `- [Listado navegable](${SITE_URL}/): la misma información en HTML, con filtros por categoría, red de pago y precio.`,
    "",
    "## Páginas por API",
    "",
    ...apis.map((a) => `- [${a.name}](${SITE_URL}/apis/${a.slug}/): ${a.category} — ${a.price_display}`),
    "",
    "## Notas para agentes",
    "",
    "- No hace falta autenticación para leer los datos.",
    "- Los campos `price_display`, `network` y `url` pueden venir en `null` cuando todavía no se confirmó el dato oficial.",
    "- El campo `protocol` identifica el rail de pago (hoy siempre `x402`; el schema queda abierto a otros valores a futuro).",
  ];
  return lines.join("\n") + "\n";
}

function renderRobotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

function renderSitemap({ apis }) {
  const urls = [
    `${SITE_URL}/`,
    ...apis.map((a) => `${SITE_URL}/apis/${a.slug}/`),
  ];
  const body = urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function build() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, "api"), { recursive: true });
  mkdirSync(join(OUT, "apis"), { recursive: true });

  const data = loadData();

  writeFileSync(join(OUT, "index.html"), renderIndex(data));

  for (const api of data.apis) {
    const dir = join(OUT, "apis", api.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), renderDetail(api));
  }

  const publicApis = data.apis.map(({ slug, tags, price, isNew, ...raw }) => raw);
  writeFileSync(join(OUT, "api", "apis.json"), JSON.stringify({ updated_at: data.updatedAt, count: publicApis.length, apis: publicApis }, null, 2));
  writeFileSync(join(OUT, "api", "apis.ndjson"), publicApis.map((a) => JSON.stringify(a)).join("\n") + "\n");

  writeFileSync(join(OUT, "llms.txt"), renderLlmsTxt(data));
  writeFileSync(join(OUT, "robots.txt"), renderRobotsTxt());
  writeFileSync(join(OUT, "sitemap.xml"), renderSitemap(data));

  cpSync(join(ROOT, "src", "styles.css"), join(OUT, "styles.css"));
  cpSync(join(ROOT, "src", "app.js"), join(OUT, "app.js"));

  console.log(`Build OK: ${data.apis.length} APIs → ${OUT}`);
}

build();
