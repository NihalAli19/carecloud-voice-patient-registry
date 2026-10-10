PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS patients (
  patient_id TEXT PRIMARY KEY NOT NULL,
  first_name TEXT NOT NULL CHECK(length(first_name) BETWEEN 1 AND 50),
  last_name TEXT NOT NULL CHECK(length(last_name) BETWEEN 1 AND 50),
  date_of_birth TEXT NOT NULL CHECK(date_of_birth GLOB '????-??-??'),
  sex TEXT NOT NULL CHECK(sex IN ('Male', 'Female', 'Other', 'Decline to Answer')),
  phone_number TEXT NOT NULL CHECK(length(phone_number) = 12 AND phone_number LIKE '+1%'),
  email TEXT,
  address_line_1 TEXT NOT NULL CHECK(length(trim(address_line_1)) BETWEEN 1 AND 200),
  address_line_2 TEXT,
  city TEXT NOT NULL CHECK(length(trim(city)) BETWEEN 1 AND 100),
  state TEXT NOT NULL CHECK(length(state) = 2),
  zip_code TEXT NOT NULL,
  insurance_provider TEXT,
  insurance_member_id TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'English',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_patients_dob ON patients(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone_number);
CREATE INDEX IF NOT EXISTS idx_patients_active_created ON patients(deleted_at, created_at DESC);

CREATE TABLE IF NOT EXISTS request_deduplication (
  idempotency_key TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS call_sessions (
  call_id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT,
  caller_number TEXT,
  status TEXT NOT NULL DEFAULT 'in-progress',
  started_at TEXT,
  ended_at TEXT,
  ended_reason TEXT,
  transcript TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_patient ON call_sessions(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_caller ON call_sessions(caller_number, created_at DESC);
