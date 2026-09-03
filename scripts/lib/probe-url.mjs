// Resuelve URLs a sondear y clasifica un 402 x402 con honestidad.
// No inventa network/asset/amount/payTo: solo lo que el challenge declara.

const SAMPLE_CUIT = "20123456786";
const SAMPLE_NORMA_ID = "1";

export const CALLABLE = Object.freeze({
  MAINNET: "mainnet",
  TESTNET: "testnet",
  DEAD: "dead",
  INCOMPLETE: "incomplete",
});

// Alias x402 v1 → CAIP-2. Solo nombres que el protocol usó como network.
// Mapear un alias declarado no es inventar la red.
const NETWORK_ALIASES = Object.freeze({
  base: "eip155:8453",
  "base-mainnet": "eip155:8453",
  "eip155:8453": "eip155:8453",
  "base-sepolia": "eip155:84532",
  "base sepolia": "eip155:84532",
  "eip155:84532": "eip155:84532",
  "base-goerli": "eip155:84531",
  "eip155:84531": "eip155:84531",
  ethereum: "eip155:1",
  mainnet: "eip155:1",
  "eth-mainnet": "eip155:1",
  "eip155:1": "eip155:1",
  sepolia: "eip155:11155111",
  "eth-sepolia": "eip155:11155111",
  "eip155:11155111": "eip155:11155111",
  goerli: "eip155:5",
  "eip155:5": "eip155:5",
  arbitrum: "eip155:42161",
  "arbitrum-one": "eip155:42161",
  "eip155:42161": "eip155:42161",
  "arbitrum-sepolia": "eip155:421614",
  "eip155:421614": "eip155:421614",
  optimism: "eip155:10",
  "eip155:10": "eip155:10",
  "optimism-sepolia": "eip155:11155420",
  "eip155:11155420": "eip155:11155420",
  polygon: "eip155:137",
  matic: "eip155:137",
  "eip155:137": "eip155:137",
  "polygon-amoy": "eip155:80002",
  amoy: "eip155:80002",
  "eip155:80002": "eip155:80002",
  "polygon-mumbai": "eip155:80001",
  mumbai: "eip155:80001",
  "eip155:80001": "eip155:80001",
  avalanche: "eip155:43114",
  "avalanche-c": "eip155:43114",
  "eip155:43114": "eip155:43114",
  "avalanche-fuji": "eip155:43113",
  fuji: "eip155:43113",
  "eip155:43113": "eip155:43113",
  bsc: "eip155:56",
  "binance-smart-chain": "eip155:56",
  "eip155:56": "eip155:56",
  // Solana: genesis prefixes usados por x402 / CAIP-2
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana-mainnet": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana:5eykt4usfv8p8njdtrepy1vzqkqzkvdp": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana-devnet": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "solana:etwtrabzayq6imfeykouru166vu2xqa1": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "solana-testnet": "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
  "solana:4uhcvjyu9pjkvqys88urdiswhxscky3z": "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
});

const MAINNET_CAIP2 = new Set([
  "eip155:1",
  "eip155:8453",
  "eip155:42161",
  "eip155:10",
  "eip155:137",
  "eip155:56",
  "eip155:43114",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
]);

const TESTNET_CAIP2 = new Set([
  "eip155:84532",
  "eip155:84531",
  "eip155:11155111",
  "eip155:5",
  "eip155:421614",
  "eip155:11155420",
  "eip155:80002",
  "eip155:80001",
  "eip155:43113",
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
]);

const NETWORK_LABELS = Object.freeze({
  "eip155:8453": "Base",
  "eip155:84532": "Base Sepolia",
  "eip155:84531": "Base Goerli",
  "eip155:1": "Ethereum",
  "eip155:11155111": "Sepolia",
  "eip155:42161": "Arbitrum",
  "eip155:421614": "Arbitrum Sepolia",
  "eip155:10": "Optimism",
  "eip155:11155420": "OP Sepolia",
  "eip155:137": "Polygon",
  "eip155:80002": "Polygon Amoy",
  "eip155:56": "BSC",
  "eip155:43114": "Avalanche",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "Solana",
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "Solana Devnet",
  "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z": "Solana Testnet",
});

export function fillPathTemplate(path, { year, casa } = {}) {
  const y = year || String(new Date().getFullYear());
  return String(path)
    .replaceAll("{year}", y)
    .replaceAll("{cuit}", SAMPLE_CUIT)
    .replaceAll("{id}", SAMPLE_NORMA_ID)
    .replaceAll("{casa}", casa || "oficial");
}

export function joinUrl(base, path) {
  if (!base) return path || null;
  if (!path) return base;
  try {
    return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
  } catch {
    return `${String(base).replace(/\/$/, "")}${String(path).startsWith("/") ? path : `/${path}`}`;
  }
}

export function resolveProbeUrl(api) {
  const targets = resolveProbeTargets(api);
  return targets[0]?.url || null;
}

export function resolveProbeTargets(api) {
  const base = api.endpoint_url || api.url;
  const endpoints = Array.isArray(api.endpoints) ? api.endpoints.filter((e) => e && e.path) : [];
  const casa = (api.taxonomy || []).find((t) => t.startsWith("fx.ar."))?.replace("fx.ar.", "");

  if (endpoints.length === 0) {
    if (!base) return [];
    return [{ path: null, method: "GET", url: base }];
  }

  if (!base) return [];

  return endpoints.map((ep) => ({
    path: ep.path,
    method: (ep.method || "GET").toUpperCase(),
    url: joinUrl(base, fillPathTemplate(ep.path, { casa })),
  }));
}

export function normalizeNetwork(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  if (NETWORK_ALIASES[lower]) return NETWORK_ALIASES[lower];

  // CAIP-2 tal cual (namespace:reference)
  if (/^[a-z0-9-]+:[a-zA-Z0-9.-]+$/.test(text)) {
    const [ns, ref] = text.split(":");
    if (ns === "eip155") return `eip155:${ref}`;
    if (ns === "solana") {
      const mapped = NETWORK_ALIASES[`solana:${ref.toLowerCase()}`];
      return mapped || `solana:${ref}`;
    }
    return text;
  }

  // "Base Sepolia (eip155:84532)" u otros display que ya traen CAIP-2
  const caip = text.match(/\b((?:eip155|solana):[a-zA-Z0-9.-]+)\b/i);
  if (caip) return normalizeNetwork(caip[1]);

  return null;
}

export function networkKind(network) {
  if (!network) return null;
  if (MAINNET_CAIP2.has(network)) return CALLABLE.MAINNET;
  if (TESTNET_CAIP2.has(network)) return CALLABLE.TESTNET;
  // CAIP-2 declarado pero no catalogado: no adivinamos mainnet vs testnet
  return null;
}

export function networkLabel(network) {
  if (!network) return null;
  return NETWORK_LABELS[network] || null;
}

export function formatNetworkDisplay(network) {
  if (!network) return null;
  const label = networkLabel(network);
  return label ? `${network} · ${label}` : network;
}

function decodeMaybeBase64Json(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // no es JSON plano
  }
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function firstString(...values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

export function parseAccept(accept) {
  if (!accept || typeof accept !== "object") {
    return { network: null, asset: null, amount: null, payTo: null };
  }
  const extra = accept.extra && typeof accept.extra === "object" ? accept.extra : {};
  const network = normalizeNetwork(
    firstString(accept.network, accept.chainId, accept.chain, extra.network)
  );
  const asset = firstString(
    accept.asset,
    extra.asset,
    extra.token,
    extra.name
  );
  const amount = firstString(
    accept.amount,
    accept.maxAmountRequired,
    accept.maxAmount,
    extra.amount
  );
  const payTo = firstString(accept.payTo, accept.pay_to, extra.payTo);
  return { network, asset, amount, payTo };
}

export function isPayComplete({ network, asset, amount, payTo }) {
  return Boolean(network && asset && amount && payTo);
}

function extractAccepts(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.accepts)) return payload.accepts;
  if (payload.accept && typeof payload.accept === "object") return [payload.accept];
  if (payload.paymentRequirements) {
    return Array.isArray(payload.paymentRequirements)
      ? payload.paymentRequirements
      : [payload.paymentRequirements];
  }
  if (payload.network || payload.payTo || payload.asset) return [payload];
  return [];
}

export function parsePaymentRequired(headers, bodyText) {
  const headerVal =
    (headers && (headers.get?.("payment-required") || headers.get?.("x-payment-required"))) ||
    null;
  let payload = decodeMaybeBase64Json(headerVal);
  if (!payload && bodyText) {
    const trimmed = String(bodyText).trim();
    if (trimmed && trimmed !== "{}") {
      payload = decodeMaybeBase64Json(trimmed);
    }
  }

  const accepts = extractAccepts(payload).map(parseAccept);
  if (accepts.length === 0) {
    return { network: null, asset: null, amount: null, payTo: null, accepts: [] };
  }

  const picked =
    accepts.find((a) => networkKind(a.network) === CALLABLE.MAINNET && isPayComplete(a)) ||
    accepts.find((a) => networkKind(a.network) === CALLABLE.TESTNET && isPayComplete(a)) ||
    accepts.find((a) => isPayComplete(a)) ||
    accepts[0];

  return { ...picked, accepts };
}

export function classifyCallable({ is_402, network, asset, amount, payTo, forceTestnet = false }) {
  if (!is_402) return CALLABLE.DEAD;
  if (!isPayComplete({ network, asset, amount, payTo })) return CALLABLE.INCOMPLETE;
  const kind = networkKind(network);
  if (forceTestnet) {
    if (kind === CALLABLE.MAINNET) return CALLABLE.TESTNET;
    if (kind === CALLABLE.TESTNET) return CALLABLE.TESTNET;
    return CALLABLE.INCOMPLETE;
  }
  if (kind === CALLABLE.MAINNET) return CALLABLE.MAINNET;
  if (kind === CALLABLE.TESTNET) return CALLABLE.TESTNET;
  return CALLABLE.INCOMPLETE;
}

export function isArAgentListing(api) {
  return Boolean(api && typeof api.id === "string" && api.id.startsWith("ar-agent"));
}

const CALLABLE_RANK = {
  [CALLABLE.MAINNET]: 3,
  [CALLABLE.TESTNET]: 2,
  [CALLABLE.INCOMPLETE]: 1,
  [CALLABLE.DEAD]: 0,
};

export function classifyListingCallable(results, { forceTestnet = false } = {}) {
  if (!results || results.length === 0) return CALLABLE.DEAD;
  let best = CALLABLE.DEAD;
  for (const r of results) {
    const c = r.callable || CALLABLE.DEAD;
    if ((CALLABLE_RANK[c] || 0) > (CALLABLE_RANK[best] || 0)) best = c;
  }
  if (forceTestnet && best === CALLABLE.MAINNET) return CALLABLE.TESTNET;
  return best;
}

export function emptyProbeResult({ url = null, path = null, error = null } = {}) {
  const probed_at = new Date().toISOString();
  return {
    url,
    path,
    http_status: null,
    is_402: false,
    network: null,
    asset: null,
    amount: null,
    payTo: null,
    callable: CALLABLE.DEAD,
    probed_at,
    last_probed_at: probed_at,
    error,
  };
}

export async function probeHttpUrl(url, { method = "GET", timeoutMs = 10000 } = {}) {
  const probed_at = new Date().toISOString();
  const headers = {
    "User-Agent": "LupaPlaza-Probe/2.0",
    Accept: "application/json, */*",
  };

  async function once(verb) {
    const response = await fetch(url, {
      method: verb,
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const http_status = response.status;
    const is_402 = http_status === 402;
    let bodyText = "";
    if (verb === "GET") {
      try {
        bodyText = await response.text();
      } catch {
        bodyText = "";
      }
    }
    const parsed = is_402
      ? parsePaymentRequired(response.headers, bodyText)
      : { network: null, asset: null, amount: null, payTo: null };
    return {
      http_status,
      is_402,
      network: parsed.network || null,
      asset: parsed.asset || null,
      amount: parsed.amount || null,
      payTo: parsed.payTo || null,
    };
  }

  try {
    const got = await once(method === "HEAD" ? "HEAD" : "GET");
    return { ...got, probed_at, last_probed_at: probed_at, error: null };
  } catch (getError) {
    if (method !== "HEAD") {
      try {
        const headed = await once("HEAD");
        return {
          ...headed,
          probed_at,
          last_probed_at: probed_at,
          error: headed.is_402 ? null : getError.message,
        };
      } catch (headError) {
        return {
          http_status: null,
          is_402: false,
          network: null,
          asset: null,
          amount: null,
          payTo: null,
          probed_at,
          last_probed_at: probed_at,
          error: headError.message || getError.message,
        };
      }
    }
    return {
      http_status: null,
      is_402: false,
      network: null,
      asset: null,
      amount: null,
      payTo: null,
      probed_at,
      last_probed_at: probed_at,
      error: getError.message,
    };
  }
}

export async function probeTarget(target, { forceTestnet = false } = {}) {
  if (!target?.url) {
    return emptyProbeResult({ path: target?.path || null, error: "No URL disponible" });
  }
  const raw = await probeHttpUrl(target.url);
  const callable = classifyCallable({ ...raw, forceTestnet });
  return {
    url: target.url,
    path: target.path ?? null,
    http_status: raw.http_status,
    is_402: raw.is_402,
    network: raw.network,
    asset: raw.asset,
    amount: raw.amount,
    payTo: raw.payTo,
    callable,
    probed_at: raw.probed_at,
    last_probed_at: raw.last_probed_at,
    error: raw.is_402
      ? null
      : raw.error || (raw.http_status != null ? `HTTP ${raw.http_status}` : "unreachable"),
  };
}

export function applyProbeToEndpoint(endpoint, result) {
  return {
    ...endpoint,
    http_status: result.http_status,
    is_402: result.is_402,
    network: result.network,
    asset: result.asset,
    amount: result.amount,
    payTo: result.payTo,
    probed_at: result.probed_at,
    callable: result.callable,
  };
}

export function applyProbeToListing(api, results) {
  const forceTestnet = isArAgentListing(api);
  const classified = results.map((r) => ({
    ...r,
    callable: classifyCallable({ ...r, forceTestnet }),
  }));
  const listingCallable = classifyListingCallable(classified, { forceTestnet });
  const preferred =
    classified.find((r) => r.callable === listingCallable && r.is_402) ||
    classified.find((r) => r.is_402) ||
    classified[0] ||
    emptyProbeResult();

  const next = { ...api };
  next.http_status = preferred.http_status;
  next.is_402 = Boolean(preferred.is_402);
  next.last_probed_at = preferred.last_probed_at || new Date().toISOString();
  next.callable = listingCallable;
  // Red/asset/amount/payTo solo del challenge. Si no vinieron, null — no se conserva copy de marketing.
  next.network = preferred.network || null;
  next.asset = preferred.asset || null;
  next.amount = preferred.amount || null;
  next.pay_to = preferred.payTo || null;

  if (Array.isArray(next.endpoints) && next.endpoints.length > 0) {
    next.endpoints = next.endpoints.map((ep) => {
      const match = classified.find((r) => r.path === ep.path);
      return match ? applyProbeToEndpoint(ep, match) : ep;
    });
  }

  return next;
}

// Compat: el fetch-ar-agent viejo usaba live|dead. Ya no.
export function classifyProbeStatus(status) {
  if (status === 402) {
    return { callable: CALLABLE.INCOMPLETE, http_status: status };
  }
  return { callable: CALLABLE.DEAD, http_status: status };
}
