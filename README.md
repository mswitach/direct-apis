# LupaPlaza

**Índice de liquidación LatAm: endpoints cobrables ahora.**

Producto: **LupaPlaza**. Código en [marketplace-402](https://github.com/mswitach/marketplace-402) — el slug del repo no cambia.

Job de producto (lock): qué **endpoint URL** puede un agente **pagar ahora** (mainnet, 402 live) y llevarse datos. No es un mapa de rieles (eso es **LupaRiel**). No es un directorio de fees de PSP (eso es **LupaPago**). No es un dump global de x402.

El HTML público solo lista mainnet + 402 live. `data/apis.json` puede guardar testnet/dead para el lab.

Sitio publicado (estático):

- **Producción:** https://lupaplaza.com — Cloudflare Pages, proyecto `lupaplaza` (hay que redeployar ese proyecto tras el merge)
- GitHub Pages (espejo): https://mswitach.github.io/marketplace-402/

---

## Qué es

**LupaPlaza** es el índice de liquidación: `data/apis.json` → `npm run build` → `public/`. Cloudflare Pages (`lupaplaza`) y GitHub Pages sirven solo ese estático.

- **Vista pública:** solo listings `callable: "mainnet"` con `is_402: true`. Hoy: semilla `lupapago-fee-mobbex` ($0.01 USDC en Base).
- **Inclusión:** mainnet + 402 live + preferencia LatAm/AR. Detalle en `/metodologia/` y `llms.txt`.
- **Lab:** las filas testnet/dead/incomplete quedan en `data/apis.json` y `/api/apis.json`. No se emiten como HTML público ni como tabs.
- **Probing honesto:** `callable` sale del 402 real (red CAIP-2, asset, amount, payTo). Un 200 de landing no es paywall.
- **Discovery Bazaar-compatible:** `GET /discovery/resources` = mismo filtro público.
- **Seller submit / probe on-demand / MCP POST:** solo Express local (`npm run dev` :3402). No hay playground.

**Lo que NO es:**

- No somos **LupaRiel** (mapa de rieles).
- No somos **LupaPago** (directorio de fees de PSP). Un recorte cobrable entra como endpoint, no como tabla de precios.
- No somos Coinbase Bazaar ni un dump de 15k servicios.
- No hay Express en producción. No hay nav de Repo en el HTML público.

---

## Cómo está armado

```
data/apis.json          → fuente de verdad: array de APIs con campos marketplace
scripts/build.mjs       → genera public/ (HTML + JSON + discovery estático + llms.txt)
scripts/probe.mjs       → batch probe (mainnet|testnet|dead|incomplete). `--only=ar-agent` para first-party
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

# First-party AR (paths; Sepolia = testnet, nunca mainnet)
npm run fetch-ar-agent

# Batch de todo el catálogo (recomendado antes de un release)
npm run probe
# Solo AR, si no corriste fetch-ar-agent:
npm run probe -- --only=ar-agent

# Genera public/ (HTML + discovery estático)
npm run build
```

Commit de `data/apis.json` + código → push a `main` → GitHub Pages (`deploy.yml`). El host de producto es **Cloudflare Pages, proyecto `lupaplaza`**: hay que redeployar ese proyecto para que lupaplaza.com tome el `public/` nuevo.

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
| `GET /discovery/resources` | Catálogo Bazaar-shaped **solo mainnet** (archivo sin extensión) |
| `GET /discovery/resources.json` | El mismo feed mainnet, con extensión |
| `GET /api/apis.json` | Dump completo con `callable` honesto. Discovery es un subset mainnet. |
| `GET /api/apis.ndjson` | Un objeto por línea |
| `GET /openapi.json` | OpenAPI 3.1 (`info.title`: LupaPlaza) |
| `GET /llms.txt` | Guía para LLMs + reglas de inclusión |
| `GET /metodologia/` | Inclusión (humanos): mainnet, 402 live, LatAm/AR; contraste vs LupaRiel / LupaPago |
| `GET /mcp/manifest.json` | Tres tools. Agentes descubren mainnet vía `/discovery/resources`. Testnet es para humanos/local. |

URLs de producción (Cloudflare Pages `lupaplaza`):

- https://lupaplaza.com/
- https://lupaplaza.com/metodologia/
- https://lupaplaza.com/apis/lupapago-fee-mobbex/
- https://lupaplaza.com/.well-known/x402.json
- https://lupaplaza.com/discovery/resources
- https://lupaplaza.com/llms.txt
- https://lupaplaza.com/api/apis.json (dump de lab; no es el índice público)

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
| `network` | string \| null | CAIP-2 parseado del 402 (p. ej. `eip155:8453`). `null` si el challenge no declara red — no se inventa |
| `asset` | string \| null | contrato USDC o símbolo si el 402 lo declara |
| `amount` | string \| null | atomic o display si el 402 lo declara |
| `protocol` | string | `"x402"` |
| `url` | string \| null | sitio oficial |
| `endpoint_url` | string \| null | endpoint base x402 |
| `pay_to` | string \| null | address de pago (del 402 si existe) |
| `source_url` | string | de dónde se detectó |
| `date_detected` | string (YYYY-MM-DD) | nunca se pisa |
| `date_updated` | string (YYYY-MM-DD) | se actualiza si cambió algo |
| `status` | string | `"active"` |
| **`callable`** | `"mainnet" \| "testnet" \| "dead" \| "incomplete"` | `npm run probe` / `fetch-ar-agent` |
| **`is_402`** | boolean | `true` solo si el último probe fue HTTP 402 |
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

- **`mainnet`**: 402 live en una red mainnet evidenciada (p. ej. `eip155:8453`, Solana mainnet). Esto es lo que publica `/discovery/resources`.
- **`testnet`**: 402 live en testnet (`eip155:84532` Base Sepolia, Solana Devnet, etc.). **Todos los listings `ar-agent-*` de Sepolia son testnet, nunca mainnet.** No se presentan como USDC de producción.
- **`dead`**: inalcanzable, no-402 cuando se esperaba paywall, o fallo claro. Un 200 de marketing no es paywall.
- **`incomplete`**: hubo 402 pero faltan `network` / `asset` / `amount` / `payTo` para pagar. Si el 402 no declara red, `network` queda `null`.

`npm run probe` sondea **cada** `endpoints[].path` (placeholders `{year}`, `{cuit}`, `{id}` se rellenan solo para el GET). Si no hay path, cae al `endpoint_url`. Parsea `PAYMENT-REQUIRED` (v2, base64) o el body JSON (v1). No inventa redes.

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

- **PAY_TO**: `0xFd576f2fEf750E202ad8DbDfEcEF088f9AA7A30F` (si el 402 lo declara)
- **Red**: Base Sepolia (`eip155:84532`) — **testnet**, no inventario mainnet
- **Gratis**: `/health`, `/.well-known/x402.json`, `/llms.txt`, `/openapi.json` (no son paywall)

```bash
npm run fetch-ar-agent
```

Si un path first-party responde 402 completo en Sepolia, queda `callable: "testnet"`. Si no hay 402 o faltan campos, `dead` / `incomplete`. Un `/health` 200 del worker no marca nada como pagable.

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
- `npm run fetch-ar-agent` / `npm run probe`: actualizan `callable` + campos de probe (commitear antes del build de release).
- `npm run build`: regenera `public/` (HTML público = mainnet 402 live, JSON de lab, discovery, llms.txt, sitemap, metodología).
- `npm test`: probe-url + build + contrato de la vista pública.
- Push a `main` → GitHub Pages. **Cloudflare Pages proyecto `lupaplaza` hay que redeployarlo** para lupaplaza.com.

---

## Contacto

**Owner**: Marcelo Switach  
**Producto**: LupaPlaza  
**Repo**: [github.com/mswitach/marketplace-402](https://github.com/mswitach/marketplace-402)  
**x402 protocol**: [x402.org](https://www.x402.org/)

---

## Licencia

Datos abiertos, código MIT (o lo que prefieras).
