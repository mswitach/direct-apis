import { strict as assert } from "node:assert";
import {
  CALLABLE,
  classifyCallable,
  classifyListingCallable,
  normalizeNetwork,
  parseAccept,
  parsePaymentRequired,
  isArAgentListing,
} from "./probe-url.mjs";

assert.equal(normalizeNetwork("eip155:8453"), "eip155:8453");
assert.equal(normalizeNetwork("base-sepolia"), "eip155:84532");
assert.equal(normalizeNetwork("Base Sepolia (eip155:84532)"), "eip155:84532");
assert.equal(normalizeNetwork("solana-devnet"), "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
assert.equal(normalizeNetwork("solana"), "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
assert.equal(normalizeNetwork("Base (USDC)"), null, "no inventar red desde copy de marketing");
assert.equal(normalizeNetwork(null), null);

const accept = parseAccept({
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0xFd576f2fEf750E202ad8DbDfEcEF088f9AA7A30F",
  extra: { name: "USDC" },
});
assert.equal(accept.network, "eip155:84532");
assert.equal(accept.amount, "1000");
assert.equal(accept.payTo, "0xFd576f2fEf750E202ad8DbDfEcEF088f9AA7A30F");

const v1 = parseAccept({
  network: "base",
  maxAmountRequired: "2000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0xabc",
});
assert.equal(v1.network, "eip155:8453");
assert.equal(v1.amount, "2000");

assert.equal(
  classifyCallable({ is_402: true, ...accept }),
  CALLABLE.TESTNET
);
assert.equal(
  classifyCallable({ is_402: true, ...v1 }),
  CALLABLE.MAINNET
);
assert.equal(
  classifyCallable({ is_402: true, ...accept, forceTestnet: true }),
  CALLABLE.TESTNET
);
assert.equal(
  classifyCallable({ is_402: true, network: "eip155:8453", asset: "x", amount: "1", payTo: "y", forceTestnet: true }),
  CALLABLE.TESTNET,
  "AR nunca mainnet"
);
assert.equal(
  classifyCallable({ is_402: true, network: null, asset: "x", amount: "1", payTo: "y" }),
  CALLABLE.INCOMPLETE
);
assert.equal(classifyCallable({ is_402: false, http_status: 200 }), CALLABLE.DEAD);
assert.equal(isArAgentListing({ id: "ar-agent-fx-usd" }), true);
assert.equal(isArAgentListing({ id: "apify" }), false);

const headers = new Headers({
  "PAYMENT-REQUIRED": Buffer.from(JSON.stringify({
    x402Version: 2,
    accepts: [accept],
  })).toString("base64"),
});
const parsed = parsePaymentRequired(headers, "{}");
assert.equal(parsed.network, "eip155:84532");
assert.equal(parsed.amount, "1000");

assert.equal(
  classifyListingCallable([{ callable: "dead" }, { callable: "testnet" }]),
  CALLABLE.TESTNET
);
assert.equal(
  classifyListingCallable([{ callable: "mainnet" }], { forceTestnet: true }),
  CALLABLE.TESTNET
);

console.log("probe-url tests ok");
