import { randomInt, randomUUID } from "node:crypto";

const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.API_KEY;
const vapiSecret = process.env.VAPI_WEBHOOK_SECRET;
if (!baseUrl || !apiKey || !vapiSecret) {
  console.error("PUBLIC_BASE_URL, API_KEY, and VAPI_WEBHOOK_SECRET are required.");
  process.exit(1);
}

const auth = { authorization: `Bearer ${apiKey}` };
const createdIds = new Set();
const suffix = String(randomInt(1000, 9999));
const secondSuffix = String(((Number(suffix) + 137) % 9000) + 1000).slice(-4);
const phone = `+1202555${suffix}`;
const secondPhone = `+1202555${secondSuffix}`;
const idempotencyKey = `smoke-${randomUUID()}`;
const patient = {
  first_name: "Synthetic",
  last_name: "SmokeTest",
  date_of_birth: "01/15/1990",
  sex: "Decline to Answer",
  phone_number: phone,
  address_line_1: "100 Test Avenue",
  city: "Washington",
  state: "DC",
  zip_code: "20001",
  preferred_language: "English",
};

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function webhook(message) {
  return request("/webhooks/vapi", {
    method: "POST",
    headers: { authorization: `Bearer ${vapiSecret}` },
    body: JSON.stringify({ message }),
  });
}

function toolPayload(body) {
  const raw = body?.results?.[0]?.result;
  return typeof raw === "string" ? JSON.parse(raw) : null;
}

function expect(actual, expected, label) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(actual)) throw new Error(`${label}: expected ${allowed.join(" or ")}, received ${actual}`);
  console.log(`PASS ${label} (${actual})`);
}

async function remove(id) {
  if (!id) return;
  const { response } = await request(`/patients/${id}`, { method: "DELETE", headers: auth });
  if (![200, 404].includes(response.status)) throw new Error(`cleanup ${id}: received ${response.status}`);
}

try {
  expect((await request("/health")).response.status, 200, "health");
  expect((await request("/patients")).response.status, 401, "patients require authentication");
  expect((await request("/patients/not/a/route", { headers: auth })).response.status, 404, "malformed patient route");
  expect((await request("/calls?limit=invalid", { headers: auth })).response.status, 400, "invalid call pagination");
  expect((await request("/patients", { method: "POST", headers: auth, body: JSON.stringify({ padding: "x".repeat(70_000) }) })).response.status, 413, "oversized JSON body");

  const first = await request("/patients", {
    method: "POST",
    headers: { ...auth, "idempotency-key": idempotencyKey },
    body: JSON.stringify(patient),
  });
  if (first.response.status !== 201) console.error("Create error response:", JSON.stringify(first.body));
  expect(first.response.status, 201, "create patient");
  const firstId = first.body?.data?.patient_id;
  if (!firstId) throw new Error("create patient: response did not include patient_id");
  createdIds.add(firstId);

  expect((await request("/webhooks/vapi", { method: "POST", body: JSON.stringify({ message: { type: "tool-calls" } }) })).response.status, 401, "Vapi webhook requires authentication");

  const callId = `smoke-call-${randomUUID()}`;
  const wrongLookup = await webhook({
    type: "tool-calls",
    call: { id: callId },
    toolCallList: [{ id: "lookup-wrong", function: { name: "lookup_patient_by_phone", arguments: { phone_number: phone, date_of_birth: "01/16/1990" } } }],
  });
  expect(wrongLookup.response.status, 200, "DOB-mismatched lookup handled");
  const wrongLookupPayload = toolPayload(wrongLookup.body);
  if (wrongLookupPayload?.identity_verified !== false || wrongLookupPayload?.patient_id || wrongLookupPayload?.first_name) {
    throw new Error("DOB-mismatched lookup disclosed patient identity or failed to reject verification");
  }

  const verifiedLookup = await webhook({
    type: "tool-calls",
    call: { id: callId },
    toolCallList: [{ id: "lookup-correct", function: { name: "lookup_patient_by_phone", arguments: { phone_number: phone, date_of_birth: "01/15/1990" } } }],
  });
  expect(verifiedLookup.response.status, 200, "DOB-matched lookup handled");
  const verifiedLookupPayload = toolPayload(verifiedLookup.body);
  if (verifiedLookupPayload?.identity_verified !== true || verifiedLookupPayload?.patient_id !== firstId) {
    throw new Error("DOB-matched lookup did not return the verified patient");
  }

  const wrongUpdate = await webhook({
    type: "tool-calls",
    call: { id: callId },
    toolCallList: [{ id: "update-wrong", function: { name: "update_patient", arguments: { patient_id: firstId, verification_date_of_birth: "01/16/1990", caller_confirmed: true, city: "Arlington", state: "VA", zip_code: "22201" } } }],
  });
  expect(wrongUpdate.response.status, 200, "DOB-mismatched update handled");
  if (!wrongUpdate.body?.results?.[0]?.error?.includes("Identity verification failed")) {
    throw new Error("DOB-mismatched update was not rejected");
  }
  const unchanged = await request(`/patients/${firstId}`, { headers: auth });
  if (unchanged.body?.data?.city !== "Washington") throw new Error("DOB-mismatched update changed the patient");

  const verifiedUpdate = await webhook({
    type: "tool-calls",
    call: { id: callId },
    toolCallList: [{ id: "update-correct", function: { name: "update_patient", arguments: { patient_id: firstId, verification_date_of_birth: "01/15/1990", caller_confirmed: true, city: "Arlington", state: "VA", zip_code: "22201" } } }],
  });
  expect(verifiedUpdate.response.status, 200, "DOB-matched update handled");
  if (toolPayload(verifiedUpdate.body)?.success !== true) throw new Error("DOB-matched update did not succeed");

  const report = await webhook({
    type: "end-of-call-report",
    call: { id: callId, customer: { number: phone } },
    endedReason: "customer-ended-call",
    artifact: { transcript: "Synthetic smoke-test transcript." },
    analysis: { summary: "Synthetic smoke-test call completed." },
  });
  expect(report.response.status, 200, "call report persisted before acknowledgement");
  const calls = await request("/calls?limit=100", { headers: auth });
  if (!calls.body?.data?.items?.some((call) => call.call_id === callId && call.patient_id === firstId)) {
    throw new Error("persisted call report was not linked to the patient");
  }

  const replay = await request("/patients", {
    method: "POST",
    headers: { ...auth, "idempotency-key": idempotencyKey },
    body: JSON.stringify(patient),
  });
  expect(replay.response.status, 200, "idempotent replay");
  if (replay.body?.data?.patient_id !== firstId || replay.response.headers.get("idempotency-replayed") !== "true") {
    throw new Error("idempotent replay did not return the original record");
  }

  expect((await request("/patients", {
    method: "POST",
    headers: { ...auth, "idempotency-key": idempotencyKey },
    body: JSON.stringify({ ...patient, city: "Arlington", state: "VA", zip_code: "22201" }),
  })).response.status, 409, "idempotency payload conflict");

  expect((await request("/patients", {
    method: "POST",
    headers: { ...auth, "idempotency-key": `duplicate-${randomUUID()}` },
    body: JSON.stringify(patient),
  })).response.status, 409, "duplicate active phone");

  const second = await request("/patients", {
    method: "POST",
    headers: { ...auth, "idempotency-key": `second-${randomUUID()}` },
    body: JSON.stringify({ ...patient, first_name: "Second", phone_number: secondPhone }),
  });
  expect(second.response.status, 201, "create second patient");
  const secondId = second.body?.data?.patient_id;
  if (!secondId) throw new Error("create second patient: response did not include patient_id");
  createdIds.add(secondId);

  expect((await request(`/patients/${secondId}`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ phone_number: phone }),
  })).response.status, 409, "duplicate phone update");

  expect((await request(`/patients/${firstId}`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ unexpected: "field" }),
  })).response.status, 422, "unknown update field");

  expect((await request(`/patients/${firstId}`, { method: "DELETE", headers: auth })).response.status, 200, "soft delete first patient");
  createdIds.delete(firstId);
  expect((await request(`/patients/${firstId}`, { headers: auth })).response.status, 404, "deleted patient is hidden");

  const recreated = await request("/patients", {
    method: "POST",
    headers: { ...auth, "idempotency-key": `recreate-${randomUUID()}` },
    body: JSON.stringify({ ...patient, first_name: "Recreated" }),
  });
  expect(recreated.response.status, 201, "reuse phone after soft delete");
  const recreatedId = recreated.body?.data?.patient_id;
  if (!recreatedId) throw new Error("recreate patient: response did not include patient_id");
  createdIds.add(recreatedId);

  console.log("Smoke test completed successfully.");
} finally {
  for (const id of createdIds) await remove(id);
}
