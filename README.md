# LupaPlaza

**Catálogo chico y confiable de APIs LatAm pagables por uso vía x402.**

Producto: **LupaPlaza**. Código en [marketplace-402](https://github.com/mswitach/marketplace-402) — el slug del repo no cambia.

Cada endpoint se prueba (probe) para saber si está vivo. Con taxonomía regional: `fx.ar.casa`, `bcra.deudores`, `afip.cuit`, `infoleg.norma`, `feriados.ar`, y más. Para agentes que descubren y pagan con x402. Para personas que buscan APIs honestas sin wash.

Sitio publicado (estático):

- GitHub Pages: https://mswitach.github.io/marketplace-402/
- Vercel (si el proyecto está conectado): raíz del deploy, `outputDirectory: public`

---

## Qué es

**LupaPlaza** es la evolución de Marketplace 402 / _x402 Index_. Sigue siendo el mismo pipeline (catálogo en `data/apis.json` → `npm run build` → `public/`). Lo que cambió en este corte:

- Nombre visible: LupaPlaza.
- Discovery para agentes **generado en build time** y servido como archivos estáticos. Vercel y GitHub Pages no corren Express.
- ~33 listings (21 curadas + 12 first-party `ar-agent-fx`). Sin wash, sin dump de 15k del Bazaar.

Incluye:

- **Probing**: cada API tiene `callable: "live" | "dead" | "unchecked"` basado en GET al path concreto (402 o 200 = live).
- **Taxonomía LatAm**: tags Unicode OK como `fx.ar.blue`, `bcra.deudores`, `afip.cuit`, `infoleg.search`.
- **Listings first-party AR**: 12 endpoints del worker `ar-agent-fx.mswitach.workers.dev`.
- **MCP en español (descripción)**: `buscar_servicios`, `obtener_servicio`, `llamar_servicio`. El proxy en vivo es **solo local**. En el host estático el agente paga el seller.
- **Discovery Bazaar-compatible (estático)**: `GET /discovery/resources`, `/.well-known/x402.json`, `/openapi.json`.
- **Seller submit / probe on-demand**: solo Express local (`npm run dev` :3402). No hay serverless de submit.

**Lo que NO es:**

- No somos Coinbase Bazaar. No listamos 15k servicios (muchos muertos o wash).
- No somos un directorio de protocolos (nada de LupaRiel ni research de rails).
- No somos CDP. No hay ingesta masiva.
- No somos un facilitador genérico. No hacemos escrow, no ramp ARS, no wallet.
- No hay Express en Fly/Railway. Decisión 28 Ago: servidor local-only.
- No hay dominio custom en este corte.

---

## Cómo está armado

```
data/apis.json          → fuente de verdad: array de APIs con campos marketplace
scripts/build.mjs       → genera public/ (HTML + JSON + discovery estático + llms.txt)
scripts/probe.mjs       → batch probe (actualiza callable). `--only=ar-agent` para first-party
scripts/fetch-ar-agent.mjs → actualiza paths + probea los 12 listings AR
scripts/enrich-taxonomy.mjs → taxonomía LatAm a APIs existentes
server/index.mjs        → Express local :3402 (submit / probe / MCP POST / search)
server/routes/discovery.mjs → /discovery/resources (misma forma que el estático)
server/routes/mcp.mjs   → /mcp, herramientas MCP en español
server/routes/api.mjs   → /api/search, /api/submit, /api/probe (local)
src/styles.css          → estilos del sitio
src/app.js              → filtro/orden client-side (progressive enhancement)
src/openapi.json        → spec; el build la copia con title LupaPlaza y servers
```

---

## Uso

### Release (probe → build)

El host estático no probea. El callable se commitea en `data/apis.json`.

```bash
npm install

# First-party AR (paths + callable honestos)
npm run fetch-ar-agent

# Opcional: batch del resto del catálogo
npm run probe
# Solo AR, si no corriste fetch-ar-agent:
npm run probe -- --only=ar-agent

# Genera public/ (HTML + discovery estático)
npm run build
```

Commit de `data/apis.json` + código → push a `main` → GitHub Pages (`deploy.yml`) y Vercel (`vercel.json`) redeployan el `public/`.

### Desarrollo local

```bash
npm run build
npm run dev
# → http://localhost:3402
# Express sirve public/ y además /api/search, /api/submit, /api/probe, POST /mcp/*
```

### Scripts de mantenimiento

```bash
npm run probe                 # todas las APIs con URL
npm run probe -- --only=ar-agent
npm run fetch-ar-agent
npm run ingest ruta/al/archivo.md
```

---

## Rutas para agentes

En **producción** (Pages / Vercel) solo existen archivos estáticos. No hay Express.

| Ruta | Qué es |
|---|---|
| `GET /.well-known/x402.json` | Manifest LupaPlaza + links de discovery |
| `GET /discovery/resources` | Catálogo Bazaar-shaped (archivo sin extensión) |
| `GET /discovery/resources.json` | El mismo JSON, con extensión (hosts que la piden) |
| `GET /api/apis.json` | Dump honesto del catálogo (misma fuente) |
| `GET /api/apis.ndjson` | Un objeto por línea |
| `GET /openapi.json` | OpenAPI 3.1 (`info.title`: LupaPlaza) |
| `GET /llms.txt` | Guía para LLMs |
| `GET /mcp/manifest.json` | Tres tools + cómo pagar al seller. **No hay MCP pay-through público.** |

URLs concretas después del merge (GitHub Pages):

- https://mswitach.github.io/marketplace-402/
- https://mswitach.github.io/marketplace-402/.well-known/x402.json
- https://mswitach.github.io/marketplace-402/discovery/resources
- https://mswitach.github.io/marketplace-402/discovery/resources.json
- https://mswitach.github.io/marketplace-402/openapi.json
- https://mswitach.github.io/marketplace-402/llms.txt
- https://mswitach.github.io/marketplace-402/mcp/manifest.json
- https://mswitach.github.io/marketplace-402/api/apis.json

Si Vercel está conectado al repo, las mismas rutas viven en la raíz del dominio de Vercel (sin el prefijo `/marketplace-402`).

### Solo local (`npm run dev` :3402)

- `GET /api/search?q=...&category=...&country=...&callable=...&taxonomy=...` — facetas
- `POST /api/submit` — seller submit (MVP: no escribe el catálogo)
- `POST /api/probe` — probe on-demand (MVP: apunta a `scripts/probe.mjs`)
- `GET /mcp` y `POST /mcp/buscar_servicios` / `obtener_servicio` / `llamar_servicio`

`llamar_servicio` **no** es un pay-through público. En local devuelve instrucciones; el agente paga el `endpoint_url` del listing.

---

## Schema de `data/apis.json`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | slug estable |
| `name` | string | nombre de la API |
| `category` | string | texto libre, se separa por `/` para chips |
| `description` | string | |
| `price_display` | string | texto de precio tal cual |
| `network` | string \| null | red de pago |
| `protocol` | string | `"x402"` |
| `url` | string \| null | sitio oficial |
| `endpoint_url` | string \| null | endpoint base x402 |
| `pay_to` | string \| null | address de pago |
| `source_url` | string | de dónde se detectó |
| `date_detected` | string (YYYY-MM-DD) | nunca se pisa |
| `date_updated` | string (YYYY-MM-DD) | se actualiza si cambió algo |
| `status` | string | `"active"` |
| **`callable`** | `"live" \| "dead" \| "unchecked"` | `npm run probe` / `fetch-ar-agent` |
| **`last_probed_at`** | string (ISO 8601) \| null | timestamp del último probe |
| **`http_status`** | number \| null | código HTTP del último probe |
| **`taxonomy`** | string[] | tags LatAm |
| **`country`** | string[] \| null | códigos ISO |
| **`extensions`** | string[] | `siwx`, `offer-receipt`, `x402r`, `signable` |
| **`is_free_tier`** | boolean | `true` si no tiene paywall |
| **`endpoints`** | array | path, method, description, price |

---

## Taxonomía LatAm (v1)

Unicode OK (Bazaar solo acepta ASCII):

- **Argentina**:
  - `fx.ar.oficial`, `fx.ar.blue`, `fx.ar.bolsa`, `fx.ar.mep`, `fx.ar.ccl`, `fx.ar.contadoconliqui`, `fx.ar.cripto`, `fx.ar.mayorista`, `fx.ar.tarjeta`
  - `bcra.deudores`, `afip.cuit`
  - `infoleg.norma`, `infoleg.search`
  - `feriados.ar`

- **AML/Compliance regional**: `aml.ar`, `aml.co`, `aml.br`, `aml.mx`, `aml.cl`, `aml.pe`

- **Registros empresariales**: `registro.ar`, `registro.rues`, `registro.cnpj`, `registro.rfc`

- **PSP fees**: `fees.psp.ar`

Genéricas (las 21 originales): `web.scraping`, `automation`, `browser`, `search.web`, `ai`, `llm`, `inference`, `blockchain`, `datos.onchain`, `clima`, `weather`, `legal`, `compliance`, `seguridad`, `security`, `salud`, `health`, `finanzas`, `cripto`, `utilidades`, `email`, `infraestructura`, `explorer`, etc.

---

## Callable status

- **`live`**: el path concreto respondió 402 (pago) o 2xx/3xx en el último probe.
- **`dead`**: no respondió, 4xx/5xx, o timeout. Un first-party muerto se marca `dead` — no se esconde.
- **`unchecked`**: aún no se probó (recién agregada o sin URL).

`npm run probe` sondea el primer `endpoints[].path` si existe (placeholders `{year}`, `{cuit}`, `{id}` se rellenan solo para el GET de probe). Si no hay path, cae al `endpoint_url`.

---

## First-party AR listings

12 endpoints del worker `ar-agent-fx.mswitach.workers.dev`. Paths alineados al well-known vivo del worker (ya no `/v1/fx/blue`; ahora `/v1/fx/usd/{casa}`).

| Endpoint | Descripción | Precio | Taxonomy |
|---|---|---|---|
| `/v1/fx/usd/oficial` | Dólar oficial BCRA | $0.001 | `fx.ar.oficial` |
| `/v1/fx/usd/blue` | Dólar blue | $0.001 | `fx.ar.blue` |
| `/v1/fx/usd/bolsa` | Dólar MEP | $0.001 | `fx.ar.bolsa`, `fx.ar.mep` |
| `/v1/fx/usd/contadoconliqui` | Dólar CCL | $0.001 | `fx.ar.ccl` |
| `/v1/fx/usd/cripto` | Dólar cripto (USDT) | $0.001 | `fx.ar.cripto` |
| `/v1/fx/usd/mayorista` | Dólar mayorista | $0.001 | `fx.ar.mayorista` |
| `/v1/fx/usd/tarjeta` | Dólar tarjeta | $0.001 | `fx.ar.tarjeta` |
| `/v1/bcra/deudores/{cuit}` | Central de Deudores BCRA | $0.01 | `bcra.deudores`, `aml.ar` |
| `/v1/cuit/{cuit}` | Validación CUIT + denominación BCRA (no padrón AFIP) | $0.01 | `afip.cuit`, `registro.ar` |
| `/v1/feriados/{year}` | Feriados argentinos | $0.001 | `feriados.ar` |
| `/v1/legal/search` | Búsqueda InfoLEG | $0.005 | `infoleg.search` |
| `/v1/legal/norma/{id}` | Texto de norma InfoLEG | $0.01 | `infoleg.norma` |

- **PAY_TO**: `0xFd576f2fEf750E202ad8DbDfEcEF088f9AA7A30F`
- **Red**: Base Sepolia (`eip155:84532`)
- **Gratis**: `/health`, `/.well-known/x402.json`, `/llms.txt`, `/openapi.json`

```bash
npm run fetch-ar-agent
```

Si un path first-party no responde 402/2xx, queda `callable: "dead"`. No se marca live por un `/health` 200 del worker.

---

## Seller submit (v1, local)

`POST http://localhost:3402/api/submit` con `{ "url": "https://..." }` recibe el envío. En v1 **no** agrega a `data/apis.json`. Agregar a mano o con un script.

---

## Roadmap (fuera de este corte)

- Hold/x402r wired checkout
- CDP Bazaar ingest filtrado (no el dump de 15k)
- 0–1% take fee
- FORTE paid-probe
- Seller payout
- Extensiones parseadas del well-known
- Express público o serverless de submit — **no** en este launch

---

## Mantenimiento

- `data/apis.json`: fuente de verdad.
- `npm run fetch-ar-agent` / `npm run probe`: actualizan `callable` ( commitear antes del build de release ).
- `npm run build`: regenera `public/` (HTML, JSON, discovery, llms.txt, sitemap).
- Push a `main` → Pages + Vercel sirven el estático.

---

## Contacto

**Owner**: Marcelo Switach  
**Producto**: LupaPlaza  
**Repo**: [github.com/mswitach/marketplace-402](https://github.com/mswitach/marketplace-402)  
**x402 protocol**: [x402.org](https://www.x402.org/)

---

## Licencia

Datos abiertos, código MIT (o lo que prefieras).
