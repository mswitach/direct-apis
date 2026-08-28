# Marketplace 402

**Catálogo chico y confiable de APIs LatAm pagables por uso vía x402.**

Cada endpoint se prueba (probe) para saber si está vivo. Con taxonomía regional: `fx.ar.casa`, `bcra.deudores`, `afip.cuit`, `infoleg.norma`, `feriados.ar`, y más. Para agentes que descubren y pagan con x402. Para personas que buscan APIs honestas sin wash.

---

## Qué es

**Marketplace 402** es la evolución del _x402 Index_. Ya no es un directorio estático: ahora es un marketplace con:

- ✅ **Probing en vivo**: cada API tiene `callable: "live" | "dead" | "unchecked"` basado en pruebas HTTP 402.
- 🌎 **Taxonomía LatAm**: tags Unicode OK como `fx.ar.blue`, `bcra.deudores`, `afip.cuit`, `infoleg.search`.
- 🇦🇷 **Listings first-party argentinas**: 12 endpoints del worker `ar-agent-fx.mswitach.workers.dev` (dólar oficial, blue, MEP, CCL, cripto, mayorista, tarjeta; BCRA deudores; AFIP CUIT; feriados; InfoLEG).
- 🛠️ **MCP en español**: herramientas `buscar_servicios`, `obtener_servicio`, `llamar_servicio` para agentes.
- 🔍 **Discovery Bazaar-compatible**: `GET /discovery/resources`, `/.well-known/x402.json`, `/openapi.json`.
- 📊 **Faceted search**: búsqueda por query, categoría, país, callable, taxonomía.
- 📝 **Seller submit**: endpoint `/api/submit` para que sellers envíen sus APIs (probe automático antes de agregar).

**Lo que NO es:**
- ❌ No somos Coinbase Bazaar. No listamos 15k servicios (muchos muertos o wash).
- ❌ No somos CDP. No ingesta masiva.
- ❌ No somos un facilitador genérico. No hacemos escrow, no ramp ARS, no wallet.
- ❌ No proxeamos AI/Firecrawl genéricos.

---

## Cómo está armado

```
data/apis.json          → fuente de verdad: array de APIs con campos marketplace
scripts/build.mjs       → genera public/ completo (HTML + JSON + llms.txt + sitemap)
scripts/probe.mjs       → batch probe de todos los endpoints (actualiza callable status)
scripts/fetch-ar-agent.mjs → fetcher para ar-agent-fx worker (agrega/actualiza first-party AR listings)
scripts/enrich-taxonomy.mjs → agrega taxonomía LatAm a APIs existentes
server/index.mjs        → servidor ligero Express para rutas dinámicas
server/routes/discovery.mjs → /discovery/resources, Bazaar-compatible
server/routes/mcp.mjs   → /mcp, herramientas MCP en español
server/routes/api.mjs   → /api/search, /api/submit, /api/probe
src/styles.css          → estilos del sitio
src/app.js              → filtro/orden client-side (progressive enhancement)
```

---

## Uso

### Desarrollo local

```bash
# Instalar (solo Express, sin deps pesadas)
npm install

# Generar sitio estático
npm run build

# Correr servidor (sirve public/ + rutas dinámicas)
npm run dev
# → http://localhost:3402
```

### Scripts de mantenimiento

```bash
# Probe batch de todos los endpoints (actualiza callable)
npm run probe

# Fetch y actualiza endpoints de ar-agent-fx worker
npm run fetch-ar-agent

# Ingest de research diario (como antes)
npm run ingest ruta/al/archivo.md
```

### Deploy

El sitio productivo vive en **Vercel**:
- `vercel.json` define `buildCommand: "npm run build"` → genera `public/`
- Vercel NO corre el servidor Node (solo build estático)
- Para rutas dinámicas (`/discovery`, `/mcp`, `/api`), usar Vercel Serverless Functions (pendiente) o deploy del servidor en otro lugar (Render, Fly.io, Railway)

**Alternativa simple para MVP:** mantener las rutas dinámicas como archivos JSON estáticos generados en build time (no real-time, pero funciona sin servidor).

---

## Rutas para agentes

### Discovery

- `GET /.well-known/x402.json` → metadatos del marketplace
- `GET /discovery/resources` → catálogo completo (Bazaar-compatible)
- `GET /api/search?q=...&category=...&country=...&callable=...&taxonomy=...&sort=...` → búsqueda con facetas
- `GET /openapi.json` → OpenAPI 3.1 spec

### MCP (español)

- `GET /mcp` → manifest de herramientas
- `POST /mcp/buscar_servicios` → busca APIs (gratis)
- `POST /mcp/obtener_servicio` → detalles de una API (gratis)
- `POST /mcp/llamar_servicio` → pass-through x402 (paga al proveedor, no al marketplace)

### Datos descargables

- `/api/apis.json` → dataset completo
- `/api/apis.ndjson` → un objeto JSON por línea
- `/llms.txt` → guía para LLMs

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
| **`callable`** | `"live" \| "dead" \| "unchecked"` | actualizado por `npm run probe` |
| **`last_probed_at`** | string (ISO 8601) \| null | timestamp del último probe |
| **`http_status`** | number \| null | código HTTP del último probe |
| **`taxonomy`** | string[] | tags LatAm: `fx.ar.blue`, `bcra.deudores`, etc. |
| **`country`** | string[] \| null | códigos ISO: `["AR"]`, `["MX"]`, etc. |
| **`extensions`** | string[] | detectadas: `siwx`, `offer-receipt`, `x402r`, `signable` |
| **`is_free_tier`** | boolean | `true` si no tiene paywall |
| **`endpoints`** | array | lista de endpoints con path, method, description, price |

---

## Taxonomía LatAm (v1)

Unicode OK (Bazaar solo acepta ASCII):

- **Argentina**:
  - `fx.ar.oficial`, `fx.ar.blue`, `fx.ar.bolsa`, `fx.ar.mep`, `fx.ar.ccl`, `fx.ar.contadoconliqui`, `fx.ar.cripto`, `fx.ar.mayorista`, `fx.ar.tarjeta`
  - `bcra.deudores`, `afip.cuit`
  - `infoleg.norma`, `infoleg.search`
  - `feriados.ar`
  
- **AML/Compliance regional**:
  - `aml.ar`, `aml.co`, `aml.br`, `aml.mx`, `aml.cl`, `aml.pe`
  
- **Registros empresariales**:
  - `registro.ar` (AFIP CUIT)
  - `registro.rues` (Colombia)
  - `registro.cnpj` (Brasil)
  - `registro.rfc` (México)

- **PSP fees**:
  - `fees.psp.ar` (fees de pasarelas argentinas)

Genéricas (mantener para las 21 APIs originales):
- `web.scraping`, `automation`, `browser`, `search.web`, `ai`, `llm`, `inference`, `blockchain`, `datos.onchain`, `clima`, `weather`, `legal`, `compliance`, `seguridad`, `security`, `salud`, `health`, `finanzas`, `cripto`, `utilidades`, `email`, `infraestructura`, `explorer`, etc.

---

## Callable status

- **`live`**: el endpoint respondió 402 (requiere pago) o 200 (tier gratis) en el último probe.
- **`dead`**: el endpoint no respondió, devolvió 4xx/5xx, o timeout.
- **`unchecked`**: aún no se probó (recién agregada o sin `endpoint_url`).

El probe corre con `npm run probe` (batch de todas las APIs con `endpoint_url` definido).

---

## First-party AR listings

12 endpoints del worker `ar-agent-fx.mswitach.workers.dev`:

| Endpoint | Descripción | Precio | Taxonomy |
|---|---|---|---|
| `/v1/fx/usd` | Dólar oficial BCRA | $0.001 | `fx.ar.oficial` |
| `/v1/fx/blue` | Dólar blue | $0.001 | `fx.ar.blue` |
| `/v1/fx/bolsa` | Dólar MEP | $0.001 | `fx.ar.bolsa`, `fx.ar.mep` |
| `/v1/fx/contadoconliqui` | Dólar CCL | $0.001 | `fx.ar.ccl` |
| `/v1/fx/cripto` | Dólar cripto (USDT) | $0.001 | `fx.ar.cripto` |
| `/v1/fx/mayorista` | Dólar mayorista | $0.001 | `fx.ar.mayorista` |
| `/v1/fx/tarjeta` | Dólar tarjeta | $0.001 | `fx.ar.tarjeta` |
| `/v1/bcra/deudores` | Central de Deudores BCRA | $0.01 | `bcra.deudores`, `aml.ar` |
| `/v1/afip/cuit` | Consulta CUIT/CUIL AFIP | $0.01 | `afip.cuit`, `registro.ar` |
| `/v1/feriados/{year}` | Feriados argentinos | $0.001 | `feriados.ar` |
| `/v1/legal/search` | Búsqueda InfoLEG | $0.005 | `infoleg.search` |
| `/v1/legal/norma/{id}` | Texto de norma InfoLEG | $0.01 | `infoleg.norma` |

- **PAY_TO**: `0xFd576f2fEf750E202ad8DbDfEcEF088f9AA7A30F`
- **Red**: Base Sepolia (`eip155:84532`)
- **Gratis**: `/health`, `/.well-known/x402.json`, `/llms.txt`, `/openapi.json`

Estos endpoints se agregan/actualizan corriendo:

```bash
npm run fetch-ar-agent
```

Si el worker está caído, el script marca `callable: "unchecked"`. Si responde, `callable: "live"`.

---

## Seller submit (v1)

`POST /api/submit` con `{ "url": "https://..." }` agrega una API nueva **para revisión**.

En v1 (MVP), el endpoint retorna éxito pero NO agrega automáticamente a `data/apis.json`. En una implementación completa:
1. Fetch a `URL/.well-known/x402.json`
2. Challenge 402
3. Parsear Bazaar extension si existe
4. Agregar a `data/apis.json` con `callable: "unchecked"`

Por ahora, agregar manualmente o hacer un script aparte.

---

## Roadmap v2 (deferred)

No implementado en este MVP, pero anotado para futuro:

- [ ] **Hold/x402r wired checkout**: agentes pagan con hold de fondos y liberación condicional.
- [ ] **CDP Bazaar ingest**: traer listings del Bazaar (filtrados por calidad).
- [ ] **0–1% take fee**: el marketplace cobra comisión pequeña (hoy 0%).
- [ ] **FORTE paid-probe**: probamos un endpoint pagando la llamada real (hoy probe gratis GET esperando 402).
- [ ] **Seller payout**: sistema de pagos a sellers (hoy pass-through directo).
- [ ] **Extensions detectadas**: parsear well-known para detectar `siwx`, `offer-receipt`, `x402r`, `signable`.
- [ ] **Vercel Serverless Functions**: para `/discovery`, `/mcp`, `/api` en Vercel (hoy solo build estático).

---

## Mantenimiento

- `data/apis.json`: fuente de verdad, editarla a mano o con scripts.
- `npm run probe`: actualiza `callable` status (correr 1x/día o on-demand).
- `npm run fetch-ar-agent`: actualiza endpoints first-party AR (correr cuando el worker cambie).
- `npm run build`: regenera `public/` (HTML, JSON, llms.txt, sitemap).
- Commit y push → Vercel redeploya solo.

---

## Contacto

**Owner**: Marcelo Switach  
**Repo**: [github.com/mswitach/direct-apis](https://github.com/mswitach/direct-apis)  
**x402 protocol**: [x402.org](https://www.x402.org/)

---

## Licencia

Datos abiertos, código MIT (o lo que prefieras).
