// Resuelve la URL concreta a sondear para un listing.
// Si hay endpoints[].path, se usa ese path (con placeholders rellenos)
// en vez del root del worker — así un 200 en /health no disfraza un 404.

const SAMPLE_CUIT = "20123456786";
const SAMPLE_NORMA_ID = "1";

export function fillPathTemplate(path, { year, casa } = {}) {
  const y = year || String(new Date().getFullYear());
  return String(path)
    .replaceAll("{year}", y)
    .replaceAll("{cuit}", SAMPLE_CUIT)
    .replaceAll("{id}", SAMPLE_NORMA_ID)
    .replaceAll("{casa}", casa || "oficial");
}

export function resolveProbeUrl(api) {
  const base = api.endpoint_url || api.url;
  if (!base) return null;

  const first = Array.isArray(api.endpoints) && api.endpoints[0];
  if (first && first.path) {
    const casa = (api.taxonomy || []).find((t) => t.startsWith("fx.ar."))?.replace("fx.ar.", "");
    const filled = fillPathTemplate(first.path, { casa });
    try {
      return new URL(filled, base.endsWith("/") ? base : `${base}/`).toString();
    } catch {
      return `${base.replace(/\/$/, "")}${filled.startsWith("/") ? filled : `/${filled}`}`;
    }
  }

  return base;
}

export function classifyProbeStatus(status) {
  if (status === 402 || (status >= 200 && status < 400)) {
    return { callable: "live", http_status: status };
  }
  return { callable: "dead", http_status: status };
}
