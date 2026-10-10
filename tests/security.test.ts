import assert from "node:assert/strict";
import test from "node:test";
import { dashboardHtml } from "../src/dashboard";
import { readJson, requireApiKey, withSecurityHeaders } from "../src/http";
import type { Env } from "../src/types";
import { normalizeUsPhone, validatePatientPatch } from "../src/validation";

const env = { API_KEY: "correct-test-key", ENVIRONMENT: "production" } as Env;

test("phone normalization rejects alphabetic input and invalid NANP exchanges", () => {
  assert.equal(normalizeUsPhone("202-CALL-NOW"), undefined);
  assert.equal(normalizeUsPhone("202-155-0123"), undefined);
  assert.equal(normalizeUsPhone("202-555-0123"), "+12025550123");
});

test("patient patches reject unknown fields and control characters", () => {
  assert.match(validatePatientPatch({ role: "admin" }).errors.body ?? "", /Unsupported field/);
  assert.ok(validatePatientPatch({ city: "Safe\nInjected" }).errors.city);
});

test("JSON reader enforces content type and declared body limit", async () => {
  const wrongType = await readJson(new Request("https://example.test", { method: "POST", body: "{}", headers: { "content-type": "text/plain" } }));
  assert.equal(wrongType.response?.status, 400);

  const oversized = await readJson(new Request("https://example.test", {
    method: "POST",
    body: "{}",
    headers: { "content-type": "application/json", "content-length": "70000" },
  }));
  assert.equal(oversized.response?.status, 413);
});

test("Bearer authentication is case-insensitive and rejects malformed tokens", () => {
  assert.equal(requireApiKey(new Request("https://example.test", { headers: { authorization: "bearer correct-test-key" } }), env), null);
  assert.equal(requireApiKey(new Request("https://example.test", { headers: { authorization: "Bearer wrong key" } }), env)?.status, 401);
  assert.equal(requireApiKey(new Request("https://example.test"), env)?.headers.get("www-authenticate"), 'Bearer realm="carecloud-api"');
});

test("security headers deny framing and only emit HSTS over HTTPS", () => {
  const secure = withSecurityHeaders(new Response("ok"), new Request("https://example.test"), env);
  assert.equal(secure.headers.get("x-frame-options"), "DENY");
  assert.match(secure.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.ok(secure.headers.has("strict-transport-security"));

  const local = withSecurityHeaders(new Response("ok"), new Request("http://localhost"), env);
  assert.equal(local.headers.get("strict-transport-security"), null);
});
test("dashboard nonce matches the CSP and internal header is removed", () => {
  const nonce = "fixed-test-nonce";
  const html = dashboardHtml(nonce);
  assert.match(html, /<style nonce="fixed-test-nonce">/);
  assert.match(html, /<script nonce="fixed-test-nonce">/);
  const response = withSecurityHeaders(
    new Response(html, { headers: { "x-content-security-nonce": nonce } }),
    new Request("https://example.test/dashboard"),
    env,
  );
  assert.match(response.headers.get("content-security-policy") ?? "", /'nonce-fixed-test-nonce'/);
  assert.equal(response.headers.get("x-content-security-nonce"), null);
});