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
  SITE_HEADLINE,
  SITE_DESC,
  SITE_VERSION,
  REPO_URL,
  CONTACT_NAME,
  LOCAL_ORIGIN,
  LOCAL_PORT,
  PRODUCTION_ORIGIN,
  MCP_LIVE_NOTE,
  discoveryCatalog,
  wellKnownDocument,
  mcpManifestDocument,
  publicListings,
} from "./lib/site.mjs";
import { CALLABLE, formatNetworkDisplay } from "./lib/probe-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public");
// Dominio de producto: lupaplaza.com (Cloudflare Pages, proyecto `lupaplaza`).
// SITE_URL se puede overridear en CI/preview.
const SITE_URL = process.env.SITE_URL || PRODUCTION_ORIGIN;
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
    <a href="${BASE_PATH}/metodologia/" class="${active === "metodologia" ? "is-active" : ""}">Metodología</a>
    <a href="${BASE_PATH}/api/apis.json">JSON</a>
    <a href="${BASE_PATH}/llms.txt">llms.txt</a>
  </nav>
</header>`;
}

function siteFoot(updatedAt) {
  return `<footer class="sitefoot">
  <p><strong>${SITE_NAME}</strong> — índice de liquidación LatAm: ${SITE_HEADLINE.toLowerCase()}.</p>
  <p>No es <strong>LupaRiel</strong> (mapa de rieles) ni <strong>LupaPago</strong> (fees de PSP). Inclusión: <a href="${BASE_PATH}/metodologia/">metodología</a>.</p>
  <p>Discovery (solo mainnet 402 live): <a href="${BASE_PATH}/.well-known/x402.json">/.well-known/x402.json</a> · <a href="${BASE_PATH}/discovery/resources">/discovery/resources</a> · <a href="${BASE_PATH}/openapi.json">openapi.json</a></p>
  <p>Dump de lab (incluye testnet/dead, no es el índice público): <a href="${BASE_PATH}/api/apis.json">apis.json</a> · <a href="${BASE_PATH}/llms.txt">llms.txt</a></p>
  <p>Última actualización: <span class="mono">${updatedAt}</span>.</p>
</footer>`;
}

function priceLabel(api) {
  return escapeHtml(api.price_display || "—");
}

function callableMeta(callable) {
  switch (callable) {
    case CALLABLE.MAINNET:
      return { className: "status-mainnet", label: "mainnet" };
    case CALLABLE.TESTNET:
      return { className: "status-testnet", label: "testnet" };
    case CALLABLE.INCOMPLETE:
      return { className: "status-incomplete", label: "incomplete" };
    default:
      return { className: "status-dead", label: "dead" };
  }
}

function formatProbedAt(iso) {
  if (!iso) return "sin probe";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function networkDisplay(api) {
  return formatNetworkDisplay(api.network) || "red no declarada en el 402";
}

function apiCard(api) {
  const tagsHtml = api.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
  const taxonomyHtml = api.taxonomy && api.taxonomy.length > 0
    ? api.taxonomy.map((t) => `<span class="chip chip-taxonomy">${escapeHtml(t)}</span>`).join("")
    : "";
  const countryBadges = api.country && api.country.length > 0
    ? api.country.map((c) => `<span class="badge-country">${escapeHtml(c)}</span>`).join("")
    : "";
  const { className: callableClass } = callableMeta(CALLABLE.MAINNET);

  return `<article class="card"
  data-name="${escapeHtml(api.name.toLowerCase())}"
  data-desc="${escapeHtml(api.description.toLowerCase())}"
  data-tags="${escapeHtml(api.tags.join("|").toLowerCase())}"
  data-network="${escapeHtml((api.network || "").toLowerCase())}"
  data-price-min="${api.price.amountMin ?? ""}"
  data-new="${api.isNew ? "1" : "0"}"
  data-callable="mainnet"
  data-country="${escapeHtml((api.country || []).join("|").toLowerCase())}"
  data-taxonomy="${escapeHtml((api.taxonomy || []).join("|").toLowerCase())}">
  <div class="card-top">
    <h3><a href="${BASE_PATH}/apis/${api.slug}/">${escapeHtml(api.name)}</a></h3>
    <div class="card-badges">
      ${countryBadges}
      ${api.isNew ? '<span class="badge-new">nueva hoy</span>' : ""}
      <span class="badge-callable ${callableClass}">402 live</span>
    </div>
  </div>
  <div class="card-tags">${tagsHtml}</div>
  ${taxonomyHtml ? `<div class="card-taxonomy">${taxonomyHtml}</div>` : ""}
  <p class="card-desc">${escapeHtml(api.description)}</p>
  <div class="card-foot">
    <span class="price mono">${priceLabel(api)}</span>
    <span class="network mono">${escapeHtml(networkDisplay(api))}</span>
  </div>
  <div class="card-probe">
    <span class="probe-time mono">probe ${escapeHtml(formatProbedAt(api.last_probed_at))}</span>
    <span class="probe-402 mono">HTTP 402</span>
  </div>
</article>`;
}

function countable(apis) {
  const counts = { mainnet: 0, testnet: 0, dead: 0, incomplete: 0 };
  for (const api of apis) {
    const key = counts[api.callable] != null ? api.callable : CALLABLE.DEAD;
    counts[key]++;
  }
  return counts;
}

function renderIndex({ updatedAt, apis }) {
  const live = publicListings(apis);
  const allTags = [...new Set(live.flatMap((a) => a.tags))].sort((a, b) => a.localeCompare(b, "es"));
  const allNetworks = [...new Set(live.map((a) => a.network).filter(Boolean))].sort();
  const liveCount = live.length;

  const tagChips = allTags
    .map((t) => `<button type="button" class="filter-chip" data-filter-tag="${escapeHtml(t.toLowerCase())}">${escapeHtml(t)}</button>`)
    .join("");

  const networkOptions = allNetworks
    .map((n) => `<option value="${escapeHtml(n.toLowerCase())}">${escapeHtml(formatNetworkDisplay(n) || n)}</option>`)
    .join("");

  const cards = live.map(apiCard).join("\n");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    name: SITE_NAME,
    description: SITE_DESC,
    url: `${SITE_URL}/`,
    creator: { "@type": "Person", name: CONTACT_NAME, url: PRODUCTION_ORIGIN + "/" },
    keywords: ["x402", "LatAm", "liquidación", "agentes", "mainnet", "402"],
    isAccessibleForFree: true,
    dataset: `${SITE_URL}/discovery/resources.json`,
  };

  const body = `${siteHeader("home")}
<main class="page">
  <section class="hero">
    <p class="eyebrow">${SITE_NAME} · índice de liquidación LatAm</p>
    <h1>${SITE_HEADLINE}</h1>
    <p class="dek">Qué <strong>URL</strong> puede pagar un agente <strong>ahora</strong> (mainnet, 402 live) y llevarse los datos. Preferimos listings útiles para LatAm y Argentina. No somos un mapa de rieles (eso es LupaRiel) ni un directorio de fees de PSP (eso es LupaPago). Tampoco un dump global de x402. <a href="${BASE_PATH}/metodologia/">Cómo entra un endpoint</a>.</p>
    <dl class="stats">
      <div><dt>Cobrables ahora (mainnet 402)</dt><dd class="mono">${liveCount}</dd></div>
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

  <p class="result-count" id="result-count" aria-live="polite">${liveCount} ${liveCount === 1 ? "endpoint cobrable" : "endpoints cobrables"}</p>

  <section class="grid" id="grid">
    ${cards}
  </section>

  <p class="empty-state" id="empty-state"${liveCount === 0 ? "" : " hidden"}>No hay endpoints cobrables que matcheen esos filtros. El índice público solo muestra 402 live en mainnet (hoy: ${liveCount}).</p>
</main>
${siteFoot(updatedAt)}
<script src="${BASE_PATH}/app.js"></script>`;

  return layout({
    title: `${SITE_NAME} — ${SITE_HEADLINE}`,
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
      <div class="ledger-row"><dt>Precio (catálogo)</dt><dd class="mono">${priceLabel(api)}</dd></div>
      ${api.amount ? `<div class="ledger-row"><dt>Amount (402)</dt><dd class="mono">${escapeHtml(String(api.amount))}${api.asset ? ` · ${escapeHtml(api.asset)}` : ""}</dd></div>` : ""}
      <div class="ledger-row"><dt>Red de pago</dt><dd class="mono">${escapeHtml(networkDisplay(api))}</dd></div>
      <div class="ledger-row"><dt>Protocolo</dt><dd class="mono">${escapeHtml(api.protocol)}</dd></div>
      <div class="ledger-row"><dt>Categoría</dt><dd>${escapeHtml(api.category)}</dd></div>
      ${(() => { const m = callableMeta(CALLABLE.MAINNET); return `<div class="ledger-row"><dt>Callable</dt><dd><span class="status-badge ${m.className}">mainnet · 402 live</span></dd></div>`; })()}
      <div class="ledger-row"><dt>HTTP / 402</dt><dd class="mono">${api.http_status == null ? "—" : escapeHtml(String(api.http_status))}${api.is_402 ? " · is_402" : ""}</dd></div>
      ${api.last_probed_at ? `<div class="ledger-row"><dt>Último probe</dt><dd class="mono">${escapeHtml(formatProbedAt(api.last_probed_at))}</dd></div>` : ""}
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

function inclusionRules() {
  return [
    "## Inclusión (qué entra al índice público)",
    "",
    "LupaPlaza es un **índice de liquidación** para agentes en LatAm: qué `endpoint_url` se puede pagar **ahora** y devolver datos.",
    "",
    "Para aparecer en el HTML público, `/discovery/resources` y este listado hace falta **las tres**:",
    "",
    "1. **Mainnet** — red de producción evidenciada en el 402 (p. ej. Base `eip155:8453`). Testnet (Base Sepolia, Solana Devnet) no entra.",
    "2. **402 live** — el probe vio HTTP 402 con challenge pagable (`network`, `asset`, `amount`, `payTo`). Un 200 de landing no es paywall.",
    "3. **Preferencia LatAm / AR** — priorizamos endpoints útiles para agentes que operan en LatAm, sobre todo Argentina. No es un dump global de x402.",
    "",
    "### Qué no es LupaPlaza",
    "",
    "- **LupaRiel** es el mapa de rieles (cómo se mueve el valor). Acá no mapeamos rails.",
    "- **LupaPago** es el directorio de fees de PSP. Acá no catalogamos comisiones: si un recorte de fee es cobrable por x402, entra como *endpoint*, no como directorio de precios.",
    "- No somos Coinbase Bazaar ni un índice mundial de miles de servicios.",
    "",
    "### Lab vs público",
    "",
    "`data/apis.json` y `/api/apis.json` pueden guardar filas testnet/dead/incomplete para el lab y el probe. El HTML público, el sitemap y `/discovery/resources` **solo** muestran mainnet + 402 live.",
  ];
}

function renderMetodologia(updatedAt) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: `Metodología — ${SITE_NAME}`,
    description: "Reglas de inclusión del índice de liquidación LupaPlaza.",
    url: `${SITE_URL}/metodologia/`,
  };

  const body = `${siteHeader("metodologia")}
<main class="page page-detail">
  <nav class="breadcrumbs"><a href="${BASE_PATH}/">Listado</a> <span aria-hidden="true">/</span> Metodología</nav>
  <article class="prose">
    <p class="eyebrow">${SITE_NAME} · inclusión</p>
    <h1>Cómo entra un endpoint</h1>
    <p class="detail-desc">LupaPlaza responde una sola pregunta: <strong>qué URL puede pagar un agente ahora y llevarse los datos</strong>. El resto (rieles, fees, dumps globales) es otro producto.</p>

    <h2>Qué entra</h2>
    <ol>
      <li><strong>Mainnet.</strong> Red de producción evidenciada en el challenge 402 (p. ej. Base <span class="mono">eip155:8453</span>). Testnet no entra al índice público.</li>
      <li><strong>402 live.</strong> El probe tiene que ver un HTTP 402 con <span class="mono">network</span>, <span class="mono">asset</span>, <span class="mono">amount</span> y <span class="mono">payTo</span>. Un 200 de marketing no es paywall.</li>
      <li><strong>Preferencia LatAm / AR.</strong> Priorizamos endpoints útiles para agentes que operan en LatAm, sobre todo Argentina. No listamos el Bazaar entero.</li>
    </ol>

    <h2>Qué no es LupaPlaza</h2>
    <ul>
      <li><strong>LupaRiel</strong> — mapa de rieles: cómo se mueve el valor. Acá no mapeamos rails.</li>
      <li><strong>LupaPago</strong> — directorio de fees de PSP. Acá no catalogamos comisiones. Un recorte cobrable (p. ej. Mobbex vía x402) entra como endpoint, no como tabla de precios.</li>
      <li><strong>Dump global x402</strong> — no somos Coinbase Bazaar. Dead y testnet quedan en el lab, no en el HTML.</li>
    </ul>

    <h2>Lab vs vista pública</h2>
    <p><span class="mono">data/apis.json</span> y <a href="${BASE_PATH}/api/apis.json">/api/apis.json</a> pueden tener filas testnet, dead o incomplete para el probe. El listado, el sitemap y <a href="${BASE_PATH}/discovery/resources">/discovery/resources</a> solo publican mainnet + 402 live.</p>
    <p>No hay playground ni sandbox. El agente paga el <span class="mono">endpoint_url</span> del seller.</p>

    <h2>Cómo se clasifica</h2>
    <ul>
      <li><strong>mainnet</strong> — 402 live en red mainnet. Esto es lo público.</li>
      <li><strong>testnet</strong> — 402 live en testnet (p. ej. Base Sepolia). Lab solamente.</li>
      <li><strong>dead</strong> — inalcanzable o no-402 cuando se esperaba paywall.</li>
      <li><strong>incomplete</strong> — hubo 402 pero faltan campos para pagar.</li>
    </ul>
    <p>Última actualización del catálogo: <span class="mono">${updatedAt}</span>.</p>
  </article>
</main>
${siteFoot(updatedAt)}`;

  return layout({
    title: `Metodología — ${SITE_NAME}`,
    description: "Reglas de inclusión: mainnet, 402 live, preferencia LatAm/AR. Contraste con LupaRiel y LupaPago.",
    canonical: `${SITE_URL}/metodologia/`,
    body,
    jsonLd,
  });
}

function renderLlmsTxt({ updatedAt, apis }) {
  const live = publicListings(apis);
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESC}`,
    "",
    `Última actualización de datos: ${updatedAt}. Endpoints cobrables ahora (mainnet 402 live): ${live.length}.`,
    `Producto: ${SITE_NAME}. Host: ${PRODUCTION_ORIGIN}.`,
    "",
    `## Qué es ${SITE_NAME}`,
    "",
    "Índice de liquidación para agentes en LatAm: qué `endpoint_url` se puede pagar ahora y devolver datos.",
    "No es un mapa de rieles (eso es LupaRiel). No es un directorio de fees de PSP (eso es LupaPago). No es un dump global de x402.",
    `Semilla pública actual: recorte de fee de Mobbex vía LupaPago (\`lupapago-fee-mobbex\`) — entra porque es un endpoint cobrable, no porque LupaPlaza sea un catálogo de fees.`,
    "El sitio publicado (Cloudflare Pages, proyecto `lupaplaza`) es el output estático de `npm run build`.",
    "No hay servidor Express en producción. No hay playground ni sandbox.",
    "",
    ...inclusionRules(),
    "",
    "## Para agentes",
    "",
    "Este sitio está pensado para ser leído tanto por personas como por agentes/LLMs.",
    "El HTML público solo lista endpoints cobrables ahora (mainnet + 402 live). No hay tabs de testnet/dead.",
    "",
    "### Rutas de discovery (estáticas, sin Express)",
    "",
    `- [/.well-known/x402.json](${SITE_URL}/.well-known/x402.json): índice de endpoints cobrables (mainnet + 402 live)`,
    `- [/discovery/resources](${SITE_URL}/discovery/resources): catálogo Bazaar-shaped **solo mainnet 402 live**`,
    `- [/discovery/resources.json](${SITE_URL}/discovery/resources.json): el mismo feed, con extensión`,
    `- [/metodologia/](${SITE_URL}/metodologia/): reglas de inclusión (humanos)`,
    `- [/api/apis.json](${SITE_URL}/api/apis.json): dump de lab con callable honesto. No es el índice público.`,
    `- [/openapi.json](${SITE_URL}/openapi.json): OpenAPI 3.1 spec`,
    `- [/llms.txt](${SITE_URL}/llms.txt): esta guía`,
    `- [/mcp/manifest.json](${SITE_URL}/mcp/manifest.json): herramientas MCP. Agentes: usá /discovery/resources.`,
    "",
    "No hay `GET /api/search` en el host estático. Filtrá `discovery/resources` (índice público) en el cliente.",
    "La búsqueda con query params vive solo en Express local: `GET http://localhost:3402/api/search`.",
    "",
    "### MCP (Model Context Protocol) en español",
    "",
    "Tres herramientas. En el host estático solo hay un manifest: no hay proxy MCP público ni pay-through.",
    "",
    "- **buscar_servicios**: leé `/discovery/resources` (índice público) y filtrá (gratis)",
    "- **obtener_servicio**: buscá el `id` en ese catálogo (gratis)",
    "- **llamar_servicio**: pagá el `url`/`payTo` del seller. No hay call-through público.",
    "",
    `Live POST /mcp/* solo en \`${LOCAL_ORIGIN}/mcp\` vía \`npm run dev\` (Express :${LOCAL_PORT}).`,
    MCP_LIVE_NOTE,
    "",
    "### Datos descargables",
    "",
    `- [Índice público](${SITE_URL}/discovery/resources.json): solo mainnet + 402 live`,
    `- [Dump de lab](${SITE_URL}/api/apis.json): todas las filas del probe (testnet/dead/incomplete incluidos). No es la vista pública.`,
    `- [Listado navegable](${SITE_URL}/): HTML; solo endpoints cobrables ahora`,
    `- [Metodología](${SITE_URL}/metodologia/): inclusión y contraste vs LupaRiel / LupaPago`,
    "",
    "## Páginas públicas por API",
    "",
    ...live.map((a) => {
      const country = a.country && a.country.length > 0 ? ` (${a.country.join(", ")})` : "";
      return `- [${a.name}](${SITE_URL}/apis/${a.slug}/)${country} [mainnet]: ${a.category} — ${a.price_display}`;
    }),
    "",
    "## Schema de callable (lab)",
    "",
    "- **mainnet**: 402 live en una red mainnet evidenciada. Esto es lo que publica el índice.",
    "- **testnet**: 402 live en testnet. Lab solamente; no es USDC de producción.",
    "- **dead**: inalcanzable, no-402 cuando se esperaba paywall, o fallo claro.",
    "- **incomplete**: respondió 402 pero faltan network/asset/amount/payTo para pagar.",
    "- Un 200 en una landing no es paywall. No se marca mainnet.",
    "",
    "## Notas",
    "",
    "- No hace falta autenticación para leer el índice.",
    "- `network`/`asset`/`amount`/`pay_to` post-probe salen del 402; no se inventan.",
    "- `callable` se actualiza con `npm run probe`. Valores: mainnet | testnet | dead | incomplete.",
    "- Orden de release: probe → `npm run build` → redeploy del proyecto Cloudflare Pages `lupaplaza`.",
    "- Submit de sellers y probe on-demand: `POST` local en :3402. No hay playground público.",
  ];
  return lines.join("\n") + "\n";
}

function renderRobotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

function renderSitemap({ apis }) {
  const live = publicListings(apis);
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/metodologia/`,
    `${SITE_URL}/.well-known/x402.json`,
    `${SITE_URL}/discovery/resources.json`,
    `${SITE_URL}/openapi.json`,
    `${SITE_URL}/llms.txt`,
    `${SITE_URL}/mcp/manifest.json`,
    ...live.map((a) => `${SITE_URL}/apis/${a.slug}/`),
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
    { url: SITE_URL, description: "Estático (Cloudflare Pages `lupaplaza`) — índice público + discovery" },
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

  const live = publicListings(data.apis);

  writeFileSync(join(OUT, "index.html"), renderIndex(data));

  mkdirSync(join(OUT, "metodologia"), { recursive: true });
  writeFileSync(join(OUT, "metodologia", "index.html"), renderMetodologia(data.updatedAt));

  for (const api of live) {
    const dir = join(OUT, "apis", api.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), renderDetail(api));
  }

  const callableCounts = countable(data.apis);
  writeJson(join(OUT, "api", "apis.json"), {
    updated_at: data.updatedAt,
    count: publicApis.length,
    callable_counts: callableCounts,
    public_view: {
      filter: "mainnet + live 402",
      count: live.length,
      href: `${BASE_PATH}/discovery/resources`,
    },
    discovery: {
      href: `${BASE_PATH}/discovery/resources`,
      filter: "mainnet + live 402",
      note: "Este dump es de lab. El HTML público y /discovery/resources solo listan mainnet + 402 live.",
    },
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
  writeFileSync(
    join(OUT, "_headers"),
    [
      "/discovery/resources",
      "  Content-Type: application/json; charset=utf-8",
      "",
      "/.well-known/x402.json",
      "  Content-Type: application/json; charset=utf-8",
      "",
      "/mcp/manifest.json",
      "  Content-Type: application/json; charset=utf-8",
      "",
    ].join("\n")
  );

  cpSync(join(ROOT, "src", "styles.css"), join(OUT, "styles.css"));
  cpSync(join(ROOT, "src", "app.js"), join(OUT, "app.js"));

  console.log(`Build OK: HTML público ${live.length} · dump lab ${publicApis.length} → ${OUT}`);
  console.log(`  ${SITE_NAME} @ ${SITE_URL}`);
  console.log(`  cobrables ahora: ${catalog.count} · lab: mainnet ${callableCounts.mainnet} / testnet ${callableCounts.testnet} / dead ${callableCounts.dead} / incomplete ${callableCounts.incomplete}`);
  console.log("  estático: / /metodologia/ /.well-known/x402.json /discovery/resources /llms.txt");
}

build();
