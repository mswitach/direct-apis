# x402 Index

Índice de APIs y fuentes de datos pagables por uso vía el protocolo [x402](https://www.x402.org/), pensado para leerse tanto en un navegador como desde un agente/LLM.

## Cómo está armado

`data/apis.json` es la única fuente de verdad. Todo lo demás —el sitio HTML, el JSON público, `llms.txt`, el sitemap— se genera a partir de ese archivo con:

```
npm run build
```

Esto escribe todo en `public/` (ignorado por git).

## Hosting

El sitio productivo vive en **Vercel** (dominio propio) y se redeploya solo en cada push a `main` — Vercel detecta `vercel.json` (`buildCommand` + `outputDirectory`) sin configuración manual. GitHub Pages sigue activo como espejo secundario en `mswitach.github.io/direct-apis` vía `.github/workflows/deploy.yml`.

`SITE_URL` (canonical, JSON-LD, sitemap, links internos) se resuelve así en `build.mjs`:
1. Variable de entorno `SITE_URL`, si está seteada (usarla para fijar el dominio propio una vez conectado)
2. `VERCEL_PROJECT_PRODUCTION_URL`, que Vercel inyecta solo en cada build
3. Fallback a la URL de GitHub Pages

Como GitHub Pages sirve este repo bajo `/direct-apis/` (project site) y Vercel sirve en la raíz del dominio, `BASE_PATH` se deriva automáticamente de `SITE_URL` — no hace falta tocar nada al cambiar de hosting.

```
data/apis.json         fuente de verdad: un array de APIs, campos crudos sin normalizar
scripts/lib/normalize.mjs   slugify, tags de categoría, parseo de precio (compartido por build e ingest)
scripts/build.mjs      genera public/ completo (HTML + JSON + llms.txt + sitemap)
scripts/ingest.mjs     mergea un archivo de research diario contra data/apis.json
src/styles.css         estilos del sitio
src/app.js             filtro/orden client-side (progressive enhancement)
```

## Actualizar con el research diario

```
node scripts/ingest.mjs ruta/al/archivo-del-dia.md
npm run build
```

`ingest.mjs` espera la misma tabla markdown de siempre (columnas `# | Nombre | Categoría | Descripción | Precio | Red | URL | Fecha detectada | Fuente`). Matchea cada fila contra `data/apis.json` por el slug del nombre: si ya existe, actualiza sus campos (conservando el `date_detected` original); si no, la agrega como nueva. Al final imprime cuántas entradas se agregaron y cuántas se actualizaron.

Después de correr `ingest.mjs`, commitear `data/apis.json` y pushear a `main` alcanza — Vercel (y el workflow de GitHub Actions como espejo) hacen el build y el deploy solos.

## Schema de `data/apis.json`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | slug estable, no cambia entre corridas |
| `name` | string | |
| `category` | string | texto libre; se separa por `/` para generar los chips de filtro |
| `description` | string | |
| `price_display` | string | texto de precio tal cual viene de la fuente (el parseo a número es best-effort, ver `normalize.mjs`) |
| `network` | string \| null | red de pago, ej. `"Base (USDC)"` |
| `protocol` | string | hoy siempre `"x402"`; el campo queda abierto a otros rails a futuro |
| `url` | string \| null | sitio oficial |
| `source_url` | string | de dónde se detectó |
| `date_detected` | string (YYYY-MM-DD) | nunca se pisa una vez seteada |
| `date_updated` | string (YYYY-MM-DD) | se actualiza sólo si cambió algún campo |
| `status` | string | `"active"` por ahora |

## Salidas para agentes

- `/api/apis.json` — dataset completo
- `/api/apis.ndjson` — un objeto JSON por línea
- `/llms.txt` — guía de navegación pensada para LLMs
- Cada ficha (`/apis/<id>/`) trae JSON-LD embebido
