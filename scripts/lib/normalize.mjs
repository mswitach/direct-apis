// Funciones puras compartidas por build.mjs e ingest.mjs.
// Toda la normalización vive acá para no duplicar lógica entre los dos scripts.

export function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca tildes
    .replace(/\(.*?\)/g, "") // saca aclaraciones entre paréntesis, ej "(x402)"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "Legal / Compliance / Verificación" -> ["Legal", "Compliance", "Verificación"]
export function categoryTags(category) {
  if (!category) return [];
  return category
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Extrae un monto numérico aproximado de un texto de precio libre, para poder
// ordenar/filtrar. Si el texto no tiene un "$" parseable, devuelve amount: null
// y el texto original queda como fuente de verdad para mostrar.
export function parsePrice(display) {
  if (!display) return { amountMin: null, amountMax: null, unit: null, display };

  const amounts = [...display.matchAll(/\$([\d.]+)/g)].map((m) => parseFloat(m[1]));
  const amountMin = amounts.length ? Math.min(...amounts) : null;
  const amountMax = amounts.length ? Math.max(...amounts) : null;

  const unitMatch = display.match(/\/\s*([a-záéíóúñ]+)/i);
  const unit = unitMatch ? unitMatch[1] : null;

  return { amountMin, amountMax, unit, display };
}

export function isRecent(dateStr, referenceDateStr, days = 1) {
  if (!dateStr || !referenceDateStr) return false;
  const date = new Date(dateStr);
  const ref = new Date(referenceDateStr);
  const diffDays = (ref - date) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
