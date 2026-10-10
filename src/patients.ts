import type { PatientInput, PatientPatch, PatientRow } from "./types";
import { formatDateOfBirth } from "./validation";

const PATIENT_COLUMNS = [
  "patient_id", "first_name", "last_name", "date_of_birth", "sex", "phone_number", "email",
  "address_line_1", "address_line_2", "city", "state", "zip_code", "insurance_provider",
  "insurance_member_id", "preferred_language", "emergency_contact_name", "emergency_contact_phone",
  "created_at", "updated_at", "deleted_at",
] as const;

const INPUT_COLUMNS = [
  "first_name", "last_name", "date_of_birth", "sex", "phone_number", "email", "address_line_1",
  "address_line_2", "city", "state", "zip_code", "insurance_provider", "insurance_member_id",
  "preferred_language", "emergency_contact_name", "emergency_contact_phone",
] as const satisfies readonly (keyof PatientInput)[];

const MUTABLE_COLUMNS = new Set<string>(INPUT_COLUMNS);

export class DuplicatePatientError extends Error {
  constructor(public readonly patientId: string) {
    super("An active patient already uses that phone number.");
    this.name = "DuplicatePatientError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The Idempotency-Key was already used with a different patient payload.");
    this.name = "IdempotencyConflictError";
  }
}

export type PublicPatient = Omit<PatientRow, "date_of_birth"> & { date_of_birth: string };

type DeduplicationRow = PatientRow & { request_fingerprint: string | null };

export function toPublicPatient(row: PatientRow): PublicPatient {
  return { ...row, date_of_birth: formatDateOfBirth(row.date_of_birth) };
}

async function patientFingerprint(input: PatientInput): Promise<string> {
  const canonical = JSON.stringify(INPUT_COLUMNS.map((key) => [key, input[key] ?? null]));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getDeduplication(db: D1Database, key: string): Promise<DeduplicationRow | null> {
  return db.prepare(
    `SELECT d.request_fingerprint, p.${PATIENT_COLUMNS.join(", p.")} FROM request_deduplication d JOIN patients p ON p.patient_id = d.patient_id WHERE d.idempotency_key = ?`,
  ).bind(key).first<DeduplicationRow>();
}

function replayOrConflict(prior: DeduplicationRow | null, fingerprint: string): { row: PatientRow; replayed: true } | null {
  if (!prior) return null;
  if (prior.request_fingerprint && prior.request_fingerprint !== fingerprint) throw new IdempotencyConflictError();
  return { row: prior, replayed: true };
}

export async function getPatient(db: D1Database, patientId: string, includeDeleted = false): Promise<PatientRow | null> {
  const deleted = includeDeleted ? "" : " AND deleted_at IS NULL";
  return db.prepare(`SELECT ${PATIENT_COLUMNS.join(", ")} FROM patients WHERE patient_id = ?${deleted}`)
    .bind(patientId).first<PatientRow>();
}

export interface ListFilters {
  lastName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  limit: number;
  offset: number;
}

export async function listPatients(db: D1Database, filters: ListFilters): Promise<{ rows: PatientRow[]; total: number }> {
  const where = ["deleted_at IS NULL"];
  const binds: unknown[] = [];
  if (filters.lastName) {
    where.push("last_name = ? COLLATE NOCASE");
    binds.push(filters.lastName);
  }
  if (filters.dateOfBirth) {
    where.push("date_of_birth = ?");
    binds.push(filters.dateOfBirth);
  }
  if (filters.phoneNumber) {
    where.push("phone_number = ?");
    binds.push(filters.phoneNumber);
  }
  const clause = where.join(" AND ");
  const count = await db.prepare(`SELECT COUNT(*) AS count FROM patients WHERE ${clause}`).bind(...binds).first<{ count: number }>();
  const result = await db.prepare(
    `SELECT ${PATIENT_COLUMNS.join(", ")} FROM patients WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).bind(...binds, filters.limit, filters.offset).all<PatientRow>();
  return { rows: result.results, total: Number(count?.count ?? 0) };
}

export async function findByPhone(db: D1Database, phoneNumber: string): Promise<PatientRow | null> {
  return db.prepare(
    `SELECT ${PATIENT_COLUMNS.join(", ")} FROM patients WHERE phone_number = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
  ).bind(phoneNumber).first<PatientRow>();
}

export async function createPatient(
  db: D1Database,
  input: PatientInput,
  idempotencyKey?: string,
): Promise<{ row: PatientRow; replayed: boolean }> {
  const fingerprint = idempotencyKey ? await patientFingerprint(input) : undefined;
  if (idempotencyKey && fingerprint) {
    const replay = replayOrConflict(await getDeduplication(db, idempotencyKey), fingerprint);
    if (replay) return replay;
  }

  const duplicate = await findByPhone(db, input.phone_number);
  if (duplicate) throw new DuplicatePatientError(duplicate.patient_id);

  const patientId = crypto.randomUUID();
  const now = new Date().toISOString();
  const values = [
    patientId, input.first_name, input.last_name, input.date_of_birth, input.sex, input.phone_number,
    input.email ?? null, input.address_line_1, input.address_line_2 ?? null, input.city, input.state,
    input.zip_code, input.insurance_provider ?? null, input.insurance_member_id ?? null,
    input.preferred_language || "English", input.emergency_contact_name ?? null,
    input.emergency_contact_phone ?? null, now, now, null,
  ];
  const insert = db.prepare(
    `INSERT INTO patients (${PATIENT_COLUMNS.join(", ")}) VALUES (${PATIENT_COLUMNS.map(() => "?").join(", ")})`,
  ).bind(...values);

  try {
    if (idempotencyKey && fingerprint) {
      await db.batch([
        insert,
        db.prepare("INSERT INTO request_deduplication (idempotency_key, patient_id, created_at, request_fingerprint) VALUES (?, ?, ?, ?)")
          .bind(idempotencyKey, patientId, now, fingerprint),
      ]);
    } else {
      await insert.run();
    }
  } catch (error) {
    if (idempotencyKey && fingerprint) {
      const replay = replayOrConflict(await getDeduplication(db, idempotencyKey), fingerprint);
      if (replay) return replay;
    }
    const conflicting = await findByPhone(db, input.phone_number);
    if (conflicting) throw new DuplicatePatientError(conflicting.patient_id);
    throw error;
  }

  const row = await getPatient(db, patientId, true);
  if (!row) throw new Error("Patient insert completed but the record could not be read back.");
  return { row, replayed: false };
}

export async function updatePatient(db: D1Database, patientId: string, patch: PatientPatch): Promise<PatientRow | null> {
  const entries = Object.entries(patch).filter(([key]) => MUTABLE_COLUMNS.has(key));
  if (!entries.length) return getPatient(db, patientId);

  if (patch.phone_number) {
    const conflicting = await db.prepare(
      "SELECT patient_id FROM patients WHERE phone_number = ? AND patient_id <> ? AND deleted_at IS NULL LIMIT 1",
    ).bind(patch.phone_number, patientId).first<{ patient_id: string }>();
    if (conflicting) throw new DuplicatePatientError(conflicting.patient_id);
  }

  const assignments = entries.map(([key]) => `${key} = ?`);
  const now = new Date().toISOString();
  try {
    const result = await db.prepare(
      `UPDATE patients SET ${assignments.join(", ")}, updated_at = ? WHERE patient_id = ? AND deleted_at IS NULL`,
    ).bind(...entries.map(([, value]) => value ?? null), now, patientId).run();
    if (!result.meta.changes) return null;
  } catch (error) {
    if (patch.phone_number) {
      const conflicting = await findByPhone(db, patch.phone_number);
      if (conflicting && conflicting.patient_id !== patientId) throw new DuplicatePatientError(conflicting.patient_id);
    }
    throw error;
  }
  return getPatient(db, patientId);
}

export async function softDeletePatient(db: D1Database, patientId: string): Promise<PatientRow | null> {
  const now = new Date().toISOString();
  const result = await db.prepare(
    "UPDATE patients SET deleted_at = ?, updated_at = ? WHERE patient_id = ? AND deleted_at IS NULL",
  ).bind(now, now, patientId).run();
  if (!result.meta.changes) return null;
  return getPatient(db, patientId, true);
}

export async function linkCallToPatient(db: D1Database, callId: string | undefined, callerNumber: string | undefined, patientId: string): Promise<void> {
  if (!callId) return;
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO call_sessions (call_id, patient_id, caller_number, status, created_at, updated_at)
    VALUES (?, ?, ?, 'in-progress', ?, ?)
    ON CONFLICT(call_id) DO UPDATE SET patient_id = excluded.patient_id, caller_number = COALESCE(excluded.caller_number, call_sessions.caller_number), updated_at = excluded.updated_at
  `).bind(callId, patientId, callerNumber ?? null, now, now).run();
}

export async function recordCallReport(db: D1Database, data: {
  callId: string;
  callerNumber?: string;
  endedReason?: string;
  transcript?: string;
  summary?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO call_sessions (call_id, caller_number, status, ended_at, ended_reason, transcript, summary, created_at, updated_at)
    VALUES (?, ?, 'ended', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(call_id) DO UPDATE SET caller_number = COALESCE(excluded.caller_number, call_sessions.caller_number), status = 'ended', ended_at = excluded.ended_at, ended_reason = excluded.ended_reason, transcript = excluded.transcript, summary = excluded.summary, updated_at = excluded.updated_at
  `).bind(
    data.callId, data.callerNumber ?? null, now, data.endedReason?.slice(0, 200) ?? null,
    data.transcript?.slice(0, 100_000) ?? null, data.summary?.slice(0, 5_000) ?? null, now, now,
  ).run();
}

export async function listCallSessions(db: D1Database, limit = 25): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(`
    SELECT c.call_id, c.patient_id, c.caller_number, c.status, c.ended_reason, c.created_at, c.ended_at,
           p.first_name, p.last_name
    FROM call_sessions c LEFT JOIN patients p ON p.patient_id = c.patient_id
    ORDER BY c.created_at DESC LIMIT ?
  `).bind(limit).all<Record<string, unknown>>();
  return result.results;
}
