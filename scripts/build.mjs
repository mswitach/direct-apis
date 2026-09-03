#!/usr/bin/env node
// Genera el sitio estático completo (público para humanos y agentes) a partir
// de data/apis.json. No tiene dependencias externas: corre con "node scripts/build.mjs".
//
// Todo lo que sale de acá (HTML, JSON, llms.txt, sitemap, discovery, MCP
// manifest) se deriva del mismo archivo fuente, así que nunca puede
// desincronizarse entre sí. Vercel y GitHub Pages sirven solo este public/.

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slugify, categoryTags, parsePrice, isRecent, escapeHtml } from "./lib/normalize.mjs";
import {
  SITE_NAME,
  SITE_DESC,
  SITE_VERSION,
  REPO_URL,
  CONTACT_NAME,
  LOCAL_ORIGIN,
  LOCAL_PORT,
  MCP_LIVE_NOTE,
  discoveryCatalog,
  wellKnownDocument,
  mcpManifestDocument,
} from "./lib/site.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public");
// SITE_URL se resuelve en este orden: variable de entorno explícita (para
// fijar el dominio propio una vez conectado) → dominio de producción que
// Vercel inyecta solo en cada build → fallback a GitHub Pages, que sigue
// activo como espejo secundario y sirve el repo como "project site" bajo
// /marketplace-402/ en vez de en la raíz del dominio.
const SITE_URL =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "https://mswitach.github.io/marketplace-402";
// Todo link interno lleva este prefijo — queda vacío en Vercel (sirve en la
// raíz) y en "/marketplace-402" en GitHub Pages, derivado automáticamente de la
// URL de arriba.
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

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
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
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><text y=%2213%22 font-size=%2214%22>🔎</text></svg>">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
<link rel="stylesheet" href="${BASE_PATH}/styles.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Spectral:wght@500;600;700&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="alternate" type="application/json" href="${BASE_PATH}/api/apis.json" title="${SITE_NAME} — dataset JSON">
<link rel="alternate" type="application/json" href="${BASE_PATH}/.well-known/x402.json" title="${SITE_NAME} — x402 manifest">
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
    <span class="brand-mark">LP</span>
    <span class="brand-name">${SITE_NAME}</span>
  </a>
  <nav class="topnav">
    <a href="${BASE_PATH}/" class="${active === "home" ? "is-active" : ""}">Listado</a>
    <a href="${BASE_PATH}/api/apis.json">JSON</a>
    <a href="${BASE_PATH}/llms.txt">llms.txt</a>
    <a href="${REPO_URL}">Repo</a>
  </nav>
</header>`;
}

function siteFoot(updatedAt) {
  return `<footer class="sitefoot">
  <p><strong>${SITE_NAME}</strong> — catálogo x402. Código en <a href="${REPO_URL}">marketplace-402</a>.</p>
  <p>Discovery para agentes (estático): <a href="${BASE_PATH}/.well-known/x402.json">/.well-known/x402.json</a> · <a href="${BASE_PATH}/discovery/resources">/discovery/resources</a> · <a href="${BASE_PATH}/discovery/resources.json">resources.json</a> · <a href="${BASE_PATH}/openapi.json">openapi.json</a> · <a href="${BASE_PATH}/mcp/manifest.json">mcp/manifest.json</a></p>
  <p>Datos abiertos, sin API key: <a href="${BASE_PATH}/api/apis.json">apis.json</a> · <a href="${BASE_PATH}/api/apis.ndjson">apis.ndjson</a> · <a href="${BASE_PATH}/llms.txt">llms.txt</a></p>
  <p>Submit, probe en vivo y MCP call-through: solo local <span class="mono">npm run dev</span> :${LOCAL_PORT}. Relevamiento curado a mano. Última actualización: <span class="mono">${updatedAt}</span>.</p>
</footer>`;
}

function priceLabel(api) {
  return escapeHtml(api.price_display || "—");
}

function apiCard(api) {
  const tagsHtml = api.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
  const taxonomyHtml = api.taxonomy && api.taxonomy.length > 0
    ? api.taxonomy.map((t) => `<span class="chip chip-taxonomy">${escapeHtml(t)}</span>`).join("")
    : "";
  const countryBadges = api.country && api.country.length > 0
    ? api.country.map((c) => `<span class="badge-country">${escapeHtml(c)}</span>`).join("")
    : "";
  const callableClass = api.callable === "live" ? "status-live" : api.callable === "dead" ? "status-dead" : "status-unchecked";
  const callableLabel = api.callable === "live" ? "🟢" : api.callable === "dead" ? "🔴" : "⚪";

  return `<article class="card"
  data-name="${escapeHtml(api.name.toLowerCase())}"
  data-desc="${escapeHtml(api.description.toLowerCase())}"
  data-tags="${escapeHtml(api.tags.join("|").toLowerCase())}"
  data-network="${escapeHtml((api.network || "").toLowerCase())}"
  data-price-min="${api.price.amountMin ?? ""}"
  data-new="${api.isNew ? "1" : "0"}"
  data-callable="${api.callable || "unchecked"}"
  data-country="${escapeHtml((api.country || []).join("|").toLowerCase())}"
  data-taxonomy="${escapeHtml((api.taxonomy || []).join("|").toLowerCase())}">
  <div class="card-top">
    <h3><a href="${BASE_PATH}/apis/${api.slug}/">${escapeHtml(api.name)}</a></h3>
    <div class="card-badges">
      ${countryBadges}
      ${api.isNew ? '<span class="badge-new">nueva hoy</span>' : ""}
      <span class="badge-callable ${callableClass}" title="${api.callable || "unchecked"}">${callableLabel}</span>
    </div>
  </div>
  <div class="card-tags">${tagsHtml}</div>
  ${taxonomyHtml ? `<div class="card-taxonomy">${taxonomyHtml}</div>` : ""}
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    name: SITE_NAME,
    description: SITE_DESC,
    url: `${SITE_URL}/`,
    creator: { "@type": "Person", name: CONTACT_NAME, url: REPO_URL },
    keywords: ["x402", "LatAm", "API", "agentes", "pagos por uso"],
    isAccessibleForFree: true,
    dataset: `${SITE_URL}/api/apis.json`,
  };

  const body = `${siteHeader("home")}
<main class="page">
  <section class="hero">
    <p class="eyebrow">${SITE_NAME} · protocolo x402</p>
    <h1>Catálogo chico de APIs LatAm que un agente paga con x402</h1>
    <p class="dek">${SITE_DESC} Cada endpoint probado: sabemos qué está vivo. Sin listados muertos disfrazados ni wash trading.</p>
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
${siteFoot(updatedAt)}
<script src="${BASE_PATH}/app.js"></script>`;

  return layout({
    title: `${SITE_NAME} — APIs pagables por uso vía x402`,
    description: SITE_DESC,
    canonical: `${SITE_URL}/`,
    body,
    jsonLd,
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
    provider: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
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
    ${api.taxonomy && api.taxonomy.length > 0 ? `<div class="card-taxonomy">${api.taxonomy.map((t) => `<span class="chip chip-taxonomy">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    <h1>${escapeHtml(api.name)}</h1>
    <p class="detail-desc">${escapeHtml(api.description)}</p>

    <dl class="ledger">
      <div class="ledger-row"><dt>Precio</dt><dd class="mono">${priceLabel(api)}</dd></div>
      <div class="ledger-row"><dt>Red de pago</dt><dd>${escapeHtml(api.network || "no especificada")}</dd></div>
      <div class="ledger-row"><dt>Protocolo</dt><dd class="mono">${escapeHtml(api.protocol)}</dd></div>
      <div class="ledger-row"><dt>Categoría</dt><dd>${escapeHtml(api.category)}</dd></div>
      ${api.callable ? `<div class="ledger-row"><dt>Estado</dt><dd><span class="status-badge status-${api.callable}">${api.callable === "live" ? "🟢 Verificado vivo" : api.callable === "dead" ? "🔴 No responde" : "⚪ No verificado"}</span></dd></div>` : ""}
      ${api.last_probed_at ? `<div class="ledger-row"><dt>Último probe</dt><dd class="mono">${escapeHtml(new Date(api.last_probed_at).toLocaleString("es-AR"))}</dd></div>` : ""}
      ${api.country && api.country.length > 0 ? `<div class="ledger-row"><dt>País/región</dt><dd>${api.country.map((c) => `<span class="badge-country">${escapeHtml(c)}</span>`).join(" ")}</dd></div>` : ""}
      ${api.pay_to ? `<div class="ledger-row"><dt>Pay to</dt><dd class="mono" style="word-break: break-all; font-size: 0.8rem;">${escapeHtml(api.pay_to)}</dd></div>` : ""}
      ${api.extensions && api.extensions.length > 0 ? `<div class="ledger-row"><dt>Extensiones</dt><dd>${api.extensions.map((e) => `<span class="chip">${escapeHtml(e)}</span>`).join(" ")}</dd></div>` : ""}
      <div class="ledger-row"><dt>Detectada</dt><dd class="mono">${escapeHtml(api.date_detected)}</dd></div>
      <div class="ledger-row"><dt>Actualizada</dt><dd class="mono">${escapeHtml(api.date_updated)}</dd></div>
    </dl>

    <div class="detail-links">
      ${api.endpoint_url ? `<a class="btn-primary" href="${escapeHtml(api.endpoint_url)}">Endpoint ↗</a>` : ""}
      ${api.url && api.url !== api.endpoint_url ? `<a class="btn-ghost" href="${escapeHtml(api.url)}">Sitio oficial ↗</a>` : ""}
      ${api.source_url ? `<a class="btn-ghost" href="${escapeHtml(api.source_url.split(" ; ")[0])}">Fuente ↗</a>` : ""}
      <a class="btn-ghost" href="${BASE_PATH}/api/apis.json#${api.slug}">Ver en JSON</a>
    </div>
  </article>
</main>
<footer class="sitefoot">
  <p><a href="${BASE_PATH}/">← Volver al listado completo</a> · ${SITE_NAME}</p>
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
    `Producto: ${SITE_NAME}. Código: ${REPO_URL} (slug marketplace-402).`,
    "",
    `## Qué es ${SITE_NAME}`,
    "",
    "Un catálogo chico y confiable de APIs LatAm pagables vía x402.",
    "Cada endpoint se prueba (probe) para saber si está vivo.",
    "Incluye taxonomía regional (fx.ar.casa, bcra.deudores, afip.cuit, etc.).",
    "No listamos 15k servicios wash; preferimos calidad sobre volumen.",
    "El sitio publicado (Vercel / GitHub Pages) es solo el output estático de `npm run build`.",
    "No hay servidor Express en producción. Submit, probe en vivo y MCP call-through son local-only.",
    "",
    "## Para agentes",
    "",
    "Este sitio está pensado para ser leído tanto por personas como por agentes/LLMs.",
    "El HTML de cada página ya contiene el listado completo (sin necesidad de ejecutar JS),",
    "y además exponemos los mismos datos en formatos estructurados.",
    "",
    "### Rutas de discovery (estáticas, sin Express)",
    "",
    `- [/.well-known/x402.json](${SITE_URL}/.well-known/x402.json): metadatos del marketplace`,
    `- [/discovery/resources](${SITE_URL}/discovery/resources): catálogo Bazaar-shaped (archivo sin extensión)`,
    `- [/discovery/resources.json](${SITE_URL}/discovery/resources.json): el mismo catálogo, con extensión (hosts que exigen .json)`,
    `- [/api/apis.json](${SITE_URL}/api/apis.json): dump honesto del catálogo (misma fuente que discovery)`,
    `- [/openapi.json](${SITE_URL}/openapi.json): OpenAPI 3.1 spec`,
    `- [/llms.txt](${SITE_URL}/llms.txt): esta guía`,
    `- [/mcp/manifest.json](${SITE_URL}/mcp/manifest.json): herramientas MCP y cómo llamar al seller directo`,
    "",
    "No hay `GET /api/search` en el host estático. Filtrá `apis.json` o `discovery/resources` en el cliente.",
    "La búsqueda con query params vive solo en Express local: `GET http://localhost:3402/api/search`.",
    "",
    "### MCP (Model Context Protocol) en español",
    "",
    "Tres herramientas. En el host estático solo hay un manifest: no hay proxy MCP público ni pay-through.",
    "",
    "- **buscar_servicios**: leé `/discovery/resources` o `/api/apis.json` y filtrá (gratis)",
    "- **obtener_servicio**: buscá el `id` en ese catálogo (gratis)",
    "- **llamar_servicio**: pagá el `url`/`payTo` del seller. No hay call-through público.",
    "",
    `Live POST /mcp/* solo en \`${LOCAL_ORIGIN}/mcp\` vía \`npm run dev\` (Express :${LOCAL_PORT}).`,
    MCP_LIVE_NOTE,
    "",
    "### Datos descargables",
    "",
    `- [Dataset completo en JSON](${SITE_URL}/api/apis.json): array de objetos, un objeto por API`,
    `- [Dataset en NDJSON](${SITE_URL}/api/apis.ndjson): un objeto JSON por línea`,
    `- [Listado navegable](${SITE_URL}/): HTML con filtros por categoría, país, callable, taxonomía`,
    "",
    "## Páginas por API",
    "",
    ...apis.map((a) => {
      const callable = a.callable ? ` [${a.callable}]` : "";
      const country = a.country && a.country.length > 0 ? ` (${a.country.join(", ")})` : "";
      return `- [${a.name}](${SITE_URL}/apis/${a.slug}/)${country}${callable}: ${a.category} — ${a.price_display}`;
    }),
    "",
    "## Schema de callable status",
    "",
    "- **live**: el endpoint respondió 402 o 200 en el último probe",
    "- **dead**: el endpoint no respondió o devolvió 4xx/5xx",
    "- **unchecked**: aún no se probó",
    "",
    "## Taxonomía LatAm",
    "",
    "Usamos tags Unicode OK (Bazaar solo acepta ASCII). Ejemplos:",
    "- `fx.ar.casa`: tipos de cambio Argentina (oficial, blue, mep, ccl, cripto, mayorista, tarjeta)",
    "- `bcra.deudores`: Central de Deudores del BCRA",
    "- `afip.cuit`: consulta CUIT/CUIL (validación + identidad pública; no es padrón AFIP completo)",
    "- `infoleg.search`, `infoleg.norma`: legislación argentina",
    "- `feriados.ar`: feriados nacionales de Argentina",
    "- `aml.{ar,co,br,mx,cl,pe}`: compliance/AML por país",
    "- `registro.{rues,cnpj,rfc}`: registros empresariales RUES (CO), CNPJ (BR), RFC (MX)",
    "",
    "## Notas",
    "",
    "- No hace falta autenticación para leer los datos.",
    "- Los campos `price_display`, `network`, `url`, `endpoint_url` pueden venir en `null`.",
    "- El campo `protocol` identifica el rail de pago (hoy siempre `x402`).",
    "- `callable` se actualiza con `npm run probe` (batch) o `npm run fetch-ar-agent` (first-party AR).",
    "- Orden de release: probe (o fetch-ar-agent) → `npm run build` → deploy del `public/`.",
    "- Las APIs first-party de AR (ar-agent-fx.mswitach.workers.dev) se actualizan con `npm run fetch-ar-agent`.",
    "- Submit de sellers y probe on-demand: `POST` local en :3402 (`/api/submit`, `/api/probe`).",
  ];
  return lines.join("\n") + "\n";
}

function renderRobotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

function renderSitemap({ apis }) {
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/.well-known/x402.json`,
    `${SITE_URL}/discovery/resources.json`,
    `${SITE_URL}/openapi.json`,
    `${SITE_URL}/llms.txt`,
    `${SITE_URL}/mcp/manifest.json`,
    `${SITE_URL}/api/apis.json`,
    ...apis.map((a) => `${SITE_URL}/apis/${a.slug}/`),
  ];
  const body = urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function renderOpenApi() {
  const src = JSON.parse(readFileSync(join(ROOT, "src", "openapi.json"), "utf-8"));
  src.info = {
    ...src.info,
    title: `${SITE_NAME} API`,
    description: SITE_DESC,
    version: SITE_VERSION,
    contact: { name: CONTACT_NAME, url: REPO_URL },
  };
  src.servers = [
    { url: SITE_URL, description: "Estático (Vercel / GitHub Pages) — solo GET de discovery" },
    { url: LOCAL_ORIGIN, description: "Express local — submit, probe, MCP POST, /api/search" },
  ];
  return src;
}

function build() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, "api"), { recursive: true });
  mkdirSync(join(OUT, "apis"), { recursive: true });
  mkdirSync(join(OUT, ".well-known"), { recursive: true });
  mkdirSync(join(OUT, "discovery"), { recursive: true });
  mkdirSync(join(OUT, "mcp"), { recursive: true });

  const data = loadData();
  const catalog = discoveryCatalog({ updated_at: data.updatedAt }, data.apis);
  const wellKnown = wellKnownDocument(SITE_URL, { staticHost: true });
  const mcpManifest = mcpManifestDocument(SITE_URL, { staticHost: true });
  const publicApis = data.apis.map(({ slug, tags, price, isNew, ...raw }) => raw);

  writeFileSync(join(OUT, "index.html"), renderIndex(data));

  for (const api of data.apis) {
    const dir = join(OUT, "apis", api.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), renderDetail(api));
  }

  writeJson(join(OUT, "api", "apis.json"), {
    updated_at: data.updatedAt,
    count: publicApis.length,
    apis: publicApis,
  });
  writeFileSync(join(OUT, "api", "apis.ndjson"), publicApis.map((a) => JSON.stringify(a)).join("\n") + "\n");

  // Extensionless path so GET /discovery/resources works on hosts that sirven el archivo tal cual.
  // resources.json para GitHub Pages / CDNs que exigen extensión.
  const catalogJson = JSON.stringify(catalog, null, 2) + "\n";
  writeFileSync(join(OUT, "discovery", "resources"), catalogJson);
  writeFileSync(join(OUT, "discovery", "resources.json"), catalogJson);
  writeJson(join(OUT, ".well-known", "x402.json"), wellKnown);
  writeJson(join(OUT, "mcp", "manifest.json"), mcpManifest);
  writeJson(join(OUT, "openapi.json"), renderOpenApi());

  writeFileSync(join(OUT, "llms.txt"), renderLlmsTxt(data));
  writeFileSync(join(OUT, "robots.txt"), renderRobotsTxt());
  writeFileSync(join(OUT, "sitemap.xml"), renderSitemap(data));
  // GitHub Pages / Jekyll ignora .well-known si no hay .nojekyll.
  writeFileSync(join(OUT, ".nojekyll"), "");

  cpSync(join(ROOT, "src", "styles.css"), join(OUT, "styles.css"));
  cpSync(join(ROOT, "src", "app.js"), join(OUT, "app.js"));

  console.log(`Build OK: ${data.apis.length} APIs → ${OUT}`);
  console.log(`  ${SITE_NAME} @ ${SITE_URL}`);
  console.log("  estático: /.well-known/x402.json /discovery/resources /openapi.json /mcp/manifest.json /llms.txt");
}

build();
