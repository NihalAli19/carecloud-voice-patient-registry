import assert from "node:assert/strict";
import test from "node:test";
import { formatDateOfBirth, normalizeUsPhone, parseDateOfBirth, validatePatient, validatePatientPatch } from "../src/validation";

const validPatient = {
  first_name: "Anne-Marie",
  last_name: "O'Brien",
  date_of_birth: "02/29/1988",
  sex: "Female",
  phone_number: "(202) 555-0183",
  email: "ANNE@example.com",
  address_line_1: "123 Main Street",
  address_line_2: "Apt 4B",
  city: "Washington",
  state: "dc",
  zip_code: "20001-1234",
  insurance_provider: "Demo Health",
  insurance_member_id: "ab12345",
  preferred_language: "English",
  emergency_contact_name: "John O'Brien",
  emergency_contact_phone: "202-555-0199",
};

test("normalizes a valid US phone number to E.164", () => {
  assert.equal(normalizeUsPhone("+1 (202) 555-0183"), "+12025550183");
  assert.equal(normalizeUsPhone("123"), undefined);
  assert.equal(normalizeUsPhone("12025550183"), "+12025550183");
});

test("parses real non-future dates and rejects calendar rollover", () => {
  assert.equal(parseDateOfBirth("02/29/1988"), "1988-02-29");
  assert.equal(formatDateOfBirth("1988-02-29"), "02/29/1988");
  assert.equal(parseDateOfBirth("02/30/1988"), undefined);
  assert.equal(parseDateOfBirth("1/2/1988"), undefined);
  assert.equal(parseDateOfBirth("01/01/2999"), undefined);
});

test("normalizes and accepts a complete patient", () => {
  const result = validatePatient(validPatient);
  assert.deepEqual(result.errors, {});
  assert.equal(result.value?.date_of_birth, "1988-02-29");
  assert.equal(result.value?.phone_number, "+12025550183");
  assert.equal(result.value?.state, "DC");
  assert.equal(result.value?.email, "anne@example.com");
  assert.equal(result.value?.insurance_member_id, "AB12345");
});

test("reports field-specific failures without accepting partial records", () => {
  const result = validatePatient({ ...validPatient, first_name: "Jane3", state: "ZZ", zip_code: "123", phone_number: "555" });
  assert.equal(result.value, undefined);
  assert.ok(result.errors.first_name);
  assert.ok(result.errors.state);
  assert.ok(result.errors.zip_code);
  assert.ok(result.errors.phone_number);
});

test("partial update validates only supplied fields and permits clearing optionals", () => {
  const result = validatePatientPatch({ email: null, preferred_language: "Spanish" });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.value, { email: null, preferred_language: "Spanish" });
  assert.ok(validatePatientPatch({}).errors.body);
  assert.ok(validatePatientPatch({ first_name: "" }).errors.first_name);
});
