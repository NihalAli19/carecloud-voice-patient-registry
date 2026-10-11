import { randomUUID } from "node:crypto";

const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
if (!baseUrl) {
  console.error("PUBLIC_BASE_URL is required.");
  process.exit(1);
}

const email = `reviewer-${randomUUID()}@example.test`;
const password = "Synthetic reviewer passphrase 2026";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

function expect(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
  console.log(`PASS ${label} (${actual})`);
}

const signup = await request("/auth/signup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ display_name: "Synthetic Reviewer", email, password }),
});
expect(signup.response.status, 201, "account creation");
const cookie = signup.response.headers.get("set-cookie")?.split(";", 1)[0];
if (!cookie?.startsWith("cc_session=")) throw new Error("account creation did not issue an HttpOnly session cookie");

expect((await request("/auth/signup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ display_name: "Duplicate", email, password }),
})).response.status, 409, "duplicate account prevention");

expect((await request("/auth/me", { headers: { cookie } })).response.status, 200, "session lookup");
expect((await request("/patients", { headers: { cookie } })).response.status, 200, "session read access");
expect((await request("/patients", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: "{}",
})).response.status, 401, "session cannot mutate patient data");
expect((await request("/auth/signin", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password: "Incorrect synthetic password" }),
})).response.status, 401, "incorrect password rejection");
expect((await request("/auth/signout", { method: "POST", headers: { cookie } })).response.status, 200, "sign out");
expect((await request("/auth/me", { headers: { cookie } })).response.status, 401, "signed-out session rejection");

const signin = await request("/auth/signin", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
expect(signin.response.status, 200, "sign in");
const secondCookie = signin.response.headers.get("set-cookie")?.split(";", 1)[0];
if (!secondCookie?.startsWith("cc_session=")) throw new Error("sign in did not issue a session cookie");
expect((await request("/auth/signout", { method: "POST", headers: { cookie: secondCookie } })).response.status, 200, "final session cleanup");

console.log("Authentication smoke test completed successfully.");
