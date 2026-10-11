import assert from "node:assert/strict";
import test from "node:test";
import { landingHtml } from "../src/landing";

test("landing page presents a complete reviewer journey with a nonce-safe script", () => {
  const html = landingHtml("fixed-landing-nonce");

  assert.match(html, /Reviewer journey/);
  assert.match(html, /tel:\+18646255246/);
  assert.match(html, /href="\/dashboard"/);
  assert.match(html, /Synthetic data only/);
  assert.match(html, /<style nonce="fixed-landing-nonce">/);
  assert.match(html, /<script nonce="fixed-landing-nonce">/);

  const browserScript = /<script nonce="[^"]+">([\s\S]*)<\/script>/.exec(html)?.[1];
  assert.ok(browserScript);
  assert.doesNotThrow(() => new Function(browserScript));
});
