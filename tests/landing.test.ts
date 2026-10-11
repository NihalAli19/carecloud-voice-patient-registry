import assert from "node:assert/strict";
import test from "node:test";
import { landingHtml } from "../src/landing";

test("landing page presents a simple reviewer journey without internal status or docs UI", () => {
  const html = landingHtml("fixed-landing-nonce");

  assert.match(html, /Reviewer journey/);
  assert.match(html, /tel:\+18646255246/);
  assert.match(html, /href="\/dashboard">Sign in/);
  assert.match(html, /href="\/dashboard\?mode=signup">Create account/);
  assert.match(html, /Synthetic data only/);
  assert.match(html, /<style nonce="fixed-landing-nonce">/);
  assert.doesNotMatch(html, /Assessment status/);
  assert.doesNotMatch(html, /API documentation/);
  assert.doesNotMatch(html, /<script/);
});