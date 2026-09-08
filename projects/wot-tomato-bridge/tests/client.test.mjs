import test from "node:test";
import assert from "node:assert/strict";
import { TomatoClient, __test } from "../src/client.mjs";

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
    text: async () => JSON.stringify(body),
  };
}

test("combined battles uses only the fixed Tomato.gg host and bounded page size", async () => {
  let captured;
  const client = new TomatoClient({
    apiKey: "tmgg_test_only_key",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return jsonResponse({ meta: { status: "good" }, data: [] });
    },
  });

  await client.combinedBattles(2023807495, {
    page: 2,
    pageSize: 10,
    battleType: "onslaught",
    tankId: 12345,
    won: "won",
  });

  const url = new URL(captured.url);
  assert.equal(url.origin, "https://api.tomato.gg");
  assert.equal(url.pathname, "/api/player/combined-battles/2023807495");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("pageSize"), "10");
  assert.equal(url.searchParams.get("battleType"), "onslaught");
  assert.equal(url.searchParams.get("tankId"), "12345");
  assert.equal(url.searchParams.get("won"), "won");
  assert.equal(captured.options.method, "GET");
  assert.equal(captured.options.headers["x-api-key"], "tmgg_test_only_key");
});

test("request rejects non-player API paths before network access", async () => {
  let called = false;
  const client = new TomatoClient({ apiKey: "tmgg_test_only_key", fetchImpl: async () => { called = true; return jsonResponse({}); } });
  await assert.rejects(() => client.request("https://example.com/steal"), /outside the approved player API surface/);
  assert.equal(called, false);
});

test("API key is not embedded in the request URL", async () => {
  let capturedUrl = "";
  const client = new TomatoClient({
    apiKey: "tmgg_super_secret_test_key",
    fetchImpl: async (url) => { capturedUrl = String(url); return jsonResponse({ meta: { status: "good" }, data: [] }); },
  });
  await client.onslaughtProgression(1);
  assert.equal(capturedUrl.includes("tmgg_super_secret_test_key"), false);
});

test("upstream error text is bounded and response-size limits fail closed", async () => {
  const failing = new TomatoClient({
    apiKey: "tmgg_test_only_key",
    fetchImpl: async () => jsonResponse({ error: "private profile" }, { status: 403 }),
  });
  await assert.rejects(() => failing.onslaughtProgression(1), /private profile/);

  const oversized = new TomatoClient({
    apiKey: "tmgg_test_only_key",
    maxResponseBytes: 16,
    fetchImpl: async () => jsonResponse({ data: "this payload is definitely too large" }),
  });
  await assert.rejects(() => oversized.onslaughtProgression(1), /size limit/);
});

test("local limiter refuses requests above its fixed window budget", () => {
  const limiter = new __test.SlidingWindowLimiter(2, 1000);
  limiter.take(1000);
  limiter.take(1001);
  assert.throws(() => limiter.take(1002), /rate limit/);
  limiter.take(2001);
});
