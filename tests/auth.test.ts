import assert from "node:assert/strict";
import test from "node:test";
import {
  hashAccountPassword,
  normalizeAccountEmail,
  validateAccountPassword,
  verifyAccountPassword,
} from "../src/auth";

test("account email normalization is strict and deterministic", () => {
  assert.equal(normalizeAccountEmail(" Reviewer@Example.COM "), "reviewer@example.com");
  assert.equal(normalizeAccountEmail("missing-domain@example"), undefined);
  assert.equal(normalizeAccountEmail("space @example.com"), undefined);
});

test("account passwords require a long printable passphrase", () => {
  assert.equal(validateAccountPassword("short"), undefined);
  assert.equal(validateAccountPassword("valid passphrase 2026"), "valid passphrase 2026");
  assert.equal(validateAccountPassword("invalid\npassword value"), undefined);
});

test("password hashes use unique salts and verify without storing plaintext", async () => {
  const pepper = "test-only-pepper-that-is-longer-than-32-characters";
  const first = await hashAccountPassword("correct horse battery staple", pepper);
  const second = await hashAccountPassword("correct horse battery staple", pepper);

  assert.notEqual(first, second);
  assert.doesNotMatch(first, /correct horse/);
  assert.equal(await verifyAccountPassword("correct horse battery staple", first, pepper), true);
  assert.equal(await verifyAccountPassword("wrong password value", first, pepper), false);
  assert.equal(await verifyAccountPassword("correct horse battery staple", "invalid", pepper), false);
});
