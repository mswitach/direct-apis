import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isPublicListing, publicListings, SITE_HEADLINE, SITE_DESC } from "./site.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const OUT = join(ROOT, "public");

const catalog = JSON.parse(readFileSync(join(ROOT, "data", "apis.json"), "utf-8"));
const live = publicListings(catalog.apis);

assert.equal(isPublicListing({ callable: "mainnet", is_402: true }), true);
assert.equal(isPublicListing({ callable: "mainnet", is_402: false }), false);
assert.equal(isPublicListing({ callable: "testnet", is_402: true }), false);
assert.equal(isPublicListing({ callable: "dead", is_402: false }), false);
assert.equal(isPublicListing(null), false);

assert.equal(live.length, 6, "el índice público tiene 6 mainnet (1 LupaPago + 5)");
assert.ok(
  live.some((a) => a.id === "lupapago-fee-mobbex"),
  "la semilla mainnet lupapago-fee-mobbex tiene que ser pública"
);
for (const id of [
  "latampulse-report",
  "latamref-ar-policy-rate",
  "latamref-ar-vat",
  "latamref-ar-vat-registration-threshold",
  "toolrail-dolar-argentina",
]) {
  assert.ok(live.some((a) => a.id === id), `${id} tiene que ser público`);
}
assert.ok(
  live.every((a) => a.callable === "mainnet" && a.is_402 === true),
  "el índice público solo admite mainnet + 402 live"
);
assert.equal(
  live.filter((a) => String(a.id).startsWith("ar-agent-")).length,
  0,
  "AR Agent Sepolia no entra al índice público"
);

assert.ok(existsSync(join(OUT, "index.html")), "correr npm run build antes de este test");

const home = readFileSync(join(OUT, "index.html"), "utf-8");
assert.ok(home.includes(SITE_HEADLINE), "hero: Endpoints cobrables ahora");
assert.ok(home.includes("índice de liquidación"), "hero nombra el job");
assert.ok(home.includes("LupaRiel"), "contraste vs LupaRiel");
assert.ok(home.includes("LupaPago"), "contraste vs LupaPago");
assert.ok(home.includes("Cobrables ahora"), "stat de mainnet");
assert.ok(!home.includes("data-callable-filter"), "sin tabs callable");
assert.ok(!/data-callable="testnet"/.test(home), "sin cards testnet en el HTML");
assert.ok(!/data-callable="dead"/.test(home), "sin cards dead en el HTML");
assert.ok(!/data-callable="incomplete"/.test(home), "sin cards incomplete en el HTML");
assert.ok(!home.includes(">Testnet<"), "sin stat Testnet");
assert.ok(!home.includes("Dead / incomplete"), "sin stat dead");
assert.ok(!/href="https:\/\/github.com\/mswitach\/marketplace-402"/.test(home), "sin nav Repo");
assert.ok(!/playground|sandbox/i.test(home), "sin playground/sandbox");
assert.ok(home.includes(`>${live.length}<`), "el conteo público es el mainnet real");
assert.ok(home.includes("/apis/lupapago-fee-mobbex/"), "link a la semilla mainnet");
assert.ok(home.includes("/apis/latampulse-report/"), "link a LatAmPulse");
assert.ok(home.includes("/apis/latamref-ar-policy-rate/"), "link a latamref policy-rate");
assert.ok(home.includes("/apis/toolrail-dolar-argentina/"), "link a Toolrail dólar");
assert.ok(home.includes("latamref.dev"), "latamref se lista en .dev");
assert.ok(!/https?:\/\/latamref\.com/.test(home), "latamref.com no resuelve DNS; no listar ese host");
assert.ok(home.includes("/metodologia/"), "link a metodología");

const apiDirs = existsSync(join(OUT, "apis"))
  ? readdirSync(join(OUT, "apis")).filter((name) => existsSync(join(OUT, "apis", name, "index.html")))
  : [];
assert.deepEqual(
  apiDirs.sort(),
  live.map((a) => a.id).sort(),
  "solo se generan páginas HTML de listings públicos"
);
assert.ok(
  existsSync(join(OUT, "apis", "lupapago-fee-mobbex", "index.html")),
  "lupapago-fee-mobbex tiene que seguir publicado"
);

const MOBBEX_TX = "0x645c71d3bb855826c531187f79d4dac67590ec65c2fdcfc8c5353309afa890ee";
const EVIDENCE_BY_ID = {
  "lupapago-fee-mobbex": MOBBEX_TX,
  "latampulse-report": "0xa0e72de7ca7d7355b446d304d2923ce3df7233f0d31802e8a753c6a27b0d6122",
  "latamref-ar-policy-rate": "0x2347f1ac8627bae2db06c17ba22708395936447584649829d47d944877d67699",
  "latamref-ar-vat": "0xb9c4ef88024ee31a30bd7a689255f100a7f9fd44de5d6e9ed875e9f2f792a88f",
  "latamref-ar-vat-registration-threshold":
    "0xc816b66f151cda204616d3bf6368a7e44abd48b52c632929b84e9a2ea66af1fb",
  "toolrail-dolar-argentina": "0x9034b42782a85736691173eb25fa289444174b90667054f3e4171be9d38e6cc8",
};

for (const [id, hash] of Object.entries(EVIDENCE_BY_ID)) {
  const listing = catalog.apis.find((a) => a.id === id);
  assert.ok(listing, `${id} existe en el catálogo`);
  assert.equal(listing.evidence, hash, `${id} tiene el hash de evidencia`);
  assert.ok(
    listing.description.includes(`Tx de liquidación evidenciada: ${hash}.`),
    `${id} nombra la tx en description`
  );
  if (id !== "lupapago-fee-mobbex") {
    assert.equal(listing.date_updated, "2026-09-05", `${id} date_updated = 2026-09-05`);
  }
  const detail = readFileSync(join(OUT, "apis", id, "index.html"), "utf-8");
  assert.ok(detail.includes("Evidencia (tx)"), `${id} muestra fila Evidencia (tx)`);
  assert.ok(detail.includes(`https://basescan.org/tx/${hash}`), `${id} linkea Basescan`);
  assert.ok(detail.includes("Basescan ↗"), `${id} tiene botón Basescan`);
}

assert.ok(!existsSync(join(OUT, "apis", "apify", "index.html")), "apify (dead) no tiene HTML público");
assert.ok(!existsSync(join(OUT, "apis", "ar-agent-fx-usd", "index.html")), "AR Agent no tiene HTML público");

const metodologia = readFileSync(join(OUT, "metodologia", "index.html"), "utf-8");
assert.ok(metodologia.includes("Cómo entra un endpoint"));
assert.ok(metodologia.includes("LupaRiel"));
assert.ok(metodologia.includes("LupaPago"));
assert.ok(metodologia.includes("402 live"));
assert.ok(metodologia.includes("LatAm"));
assert.ok(!/playground|sandbox/i.test(metodologia) || metodologia.includes("No hay playground"));

const llms = readFileSync(join(OUT, "llms.txt"), "utf-8");
assert.ok(llms.includes("Inclusión"));
assert.ok(llms.includes("LupaRiel"));
assert.ok(llms.includes("LupaPago"));
assert.ok(llms.includes("mainnet"));
assert.ok(llms.includes("402 live"));
assert.ok(llms.includes("lupapago-fee-mobbex"));
assert.ok(!llms.includes("[dead]"), "llms.txt no lista páginas dead");
assert.ok(!llms.includes("[testnet]"), "llms.txt no lista páginas testnet");
assert.ok(llms.includes(SITE_DESC.split(":")[0]));

const sitemap = readFileSync(join(OUT, "sitemap.xml"), "utf-8");
assert.ok(sitemap.includes("/metodologia/"));
assert.ok(sitemap.includes("/apis/lupapago-fee-mobbex/"));
assert.ok(sitemap.includes("/apis/latampulse-report/"));
assert.ok(sitemap.includes("/apis/latamref-ar-vat/"));
assert.ok(sitemap.includes("/apis/toolrail-dolar-argentina/"));
assert.ok(!sitemap.includes("/apis/apify/"));
assert.ok(!sitemap.includes("/apis/ar-agent-"));

const discovery = JSON.parse(readFileSync(join(OUT, "discovery", "resources.json"), "utf-8"));
assert.equal(discovery.count, 6, "discovery público = 6 mainnet");
assert.equal(discovery.count, live.length);
assert.ok(discovery.resources.every((r) => r.callable === "mainnet" && r.is_402 === true));
assert.ok(
  !JSON.stringify(discovery).includes("latamref.com/"),
  "discovery no apunta a latamref.com"
);

assert.ok(existsSync(join(OUT, "_headers")), "Cloudflare Pages _headers");

console.log(`public-view tests ok (${live.length} cobrable(s), ${catalog.apis.length} en lab)`);
