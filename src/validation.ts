import { SEX_VALUES, type PatientInput, type PatientPatch, type ValidationResult } from "./types";

const STATES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "),
);
const NAME = /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/;
const FULL_NAME = /^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP = /^\d{5}(?:-\d{4})?$/;
const MEMBER_ID = /^[A-Za-z0-9]+$/;
const SAFE_TEXT = /^[^\u0000-\u001F\u007F]*$/;

const asText = (value: unknown): string | undefined =>
  typeof value === "string" ? value.trim() : undefined;

function safeText(text: string | undefined, maxLength: number): boolean {
  return Boolean(text && text.length <= maxLength && SAFE_TEXT.test(text));
}

export function normalizeUsPhone(value: unknown): string | undefined {
  const raw = asText(value);
  if (!raw || /[A-Za-z]/.test(raw) || /[^0-9+().\-\s]/.test(raw)) return undefined;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10 || digits[0] === "0" || digits[0] === "1" || digits[3] === "0" || digits[3] === "1") return undefined;
  return `+1${digits}`;
}

export function parseDateOfBirth(value: unknown): string | undefined {
  const raw = asText(value);
  if (!raw) return undefined;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (!match) return undefined;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getTime() > Date.now()
  ) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDateOfBirth(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

function validateField(field: keyof PatientInput, input: Record<string, unknown>, errors: Record<string, string>): unknown {
  const value = input[field];
  const text = asText(value);
  switch (field) {
    case "first_name":
    case "last_name":
      if (!text || text.length > 50 || !NAME.test(text)) errors[field] = "Must be 1–50 letters with optional hyphens or apostrophes.";
      return text;
    case "date_of_birth": {
      const parsed = parseDateOfBirth(value);
      if (!parsed) errors[field] = "Must be a real, non-future date in MM/DD/YYYY format.";
      return parsed;
    }
    case "sex":
      if (!text || !(SEX_VALUES as readonly string[]).includes(text)) errors[field] = `Must be one of: ${SEX_VALUES.join(", ")}.`;
      return text;
    case "phone_number":
    case "emergency_contact_phone": {
      if ((value === undefined || value === null || text === "") && field === "emergency_contact_phone") return null;
      const phone = normalizeUsPhone(value);
      if (!phone) errors[field] = "Must be a valid 10-digit U.S. phone number.";
      return phone;
    }
    case "email":
      if (value === undefined || value === null || text === "") return null;
      if (!text || text.length > 254 || !EMAIL.test(text) || !SAFE_TEXT.test(text)) errors[field] = "Must be a valid email address.";
      return text?.toLowerCase();
    case "address_line_1":
      if (!safeText(text, 200)) errors[field] = "Must be a street address between 1 and 200 characters without control characters.";
      return text;
    case "address_line_2":
      if (value === undefined || value === null || text === "") return null;
      if (!safeText(text, 100)) errors[field] = "Must be no more than 100 characters and cannot contain control characters.";
      return text;
    case "city":
      if (!safeText(text, 100)) errors[field] = "Must be between 1 and 100 characters without control characters.";
      return text;
    case "state": {
      const state = text?.toUpperCase();
      if (!state || !STATES.has(state)) errors[field] = "Must be a valid two-letter U.S. state or DC abbreviation.";
      return state;
    }
    case "zip_code":
      if (!text || !ZIP.test(text)) errors[field] = "Must be a 5-digit ZIP or ZIP+4.";
      return text;
    case "insurance_provider":
      if (value === undefined || value === null || text === "") return null;
      if (!safeText(text, 100)) errors[field] = "Must be no more than 100 characters and cannot contain control characters.";
      return text;
    case "insurance_member_id":
      if (value === undefined || value === null || text === "") return null;
      if (!text || text.length > 50 || !MEMBER_ID.test(text)) errors[field] = "Must be 1–50 alphanumeric characters.";
      return text?.toUpperCase();
    case "preferred_language":
      if (value === undefined || value === null || text === "") return "English";
      if (!safeText(text, 50)) errors[field] = "Must be no more than 50 characters and cannot contain control characters.";
      return text;
    case "emergency_contact_name":
      if (value === undefined || value === null || text === "") return null;
      if (!text || text.length > 100 || !FULL_NAME.test(text)) errors[field] = "Must be a valid full name up to 100 characters.";
      return text;
  }
}

const REQUIRED: Array<keyof PatientInput> = [
  "first_name", "last_name", "date_of_birth", "sex", "phone_number",
  "address_line_1", "city", "state", "zip_code",
];
const ALL_FIELDS: Array<keyof PatientInput> = [
  ...REQUIRED, "email", "address_line_2", "insurance_provider", "insurance_member_id",
  "preferred_language", "emergency_contact_name", "emergency_contact_phone",
];
const FIELD_SET = new Set<string>(ALL_FIELDS);

function unsupportedFields(source: Record<string, unknown>): string[] {
  return Object.keys(source).filter((field) => !FIELD_SET.has(field)).sort();
}

export function validatePatient(input: unknown): ValidationResult<PatientInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: { body: "Expected a JSON object." } };
  const source = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const unsupported = unsupportedFields(source);
  if (unsupported.length) errors.body = `Unsupported field${unsupported.length === 1 ? "" : "s"}: ${unsupported.join(", ")}.`;
  for (const field of REQUIRED) if (source[field] === undefined || source[field] === null || source[field] === "") errors[field] = "This field is required.";
  const output: Record<string, unknown> = {};
  for (const field of ALL_FIELDS) output[field] = validateField(field, source, errors);
  return Object.keys(errors).length ? { errors } : { value: output as unknown as PatientInput, errors };
}

export function validatePatientPatch(input: unknown): ValidationResult<PatientPatch> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: { body: "Expected a JSON object." } };
  const source = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const unsupported = unsupportedFields(source);
  if (unsupported.length) errors.body = `Unsupported field${unsupported.length === 1 ? "" : "s"}: ${unsupported.join(", ")}.`;
  const output: Record<string, unknown> = {};
  for (const field of ALL_FIELDS) {
    if (!(field in source)) continue;
    if (REQUIRED.includes(field) && (source[field] === null || source[field] === "")) {
      errors[field] = "Required fields cannot be cleared.";
      continue;
    }
    output[field] = validateField(field, source, errors);
  }
  if (Object.keys(output).length === 0 && Object.keys(errors).length === 0) errors.body = "Provide at least one supported field to update.";
  return Object.keys(errors).length ? { errors } : { value: output as PatientPatch, errors };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
