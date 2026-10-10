export interface Env {
  DB: D1Database;
  API_KEY?: string;
  VAPI_WEBHOOK_SECRET?: string;
  ALLOWED_ORIGIN?: string;
  ENVIRONMENT?: string;
}

export const SEX_VALUES = ["Male", "Female", "Other", "Decline to Answer"] as const;
export type Sex = (typeof SEX_VALUES)[number];

export interface PatientInput {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: Sex;
  phone_number: string;
  email?: string | null;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  zip_code: string;
  insurance_provider?: string | null;
  insurance_member_id?: string | null;
  preferred_language?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

export type PatientPatch = Partial<PatientInput>;

export interface PatientRow extends Omit<PatientInput, "date_of_birth" | "preferred_language"> {
  patient_id: string;
  date_of_birth: string;
  preferred_language: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ValidationResult<T> {
  value?: T;
  errors: Record<string, string>;
}

export interface VapiToolCall {
  id: string;
  function?: {
    name?: string;
    arguments?: Record<string, unknown> | string;
  };
}

export interface VapiMessage {
  type?: string;
  toolCallList?: VapiToolCall[];
  call?: { id?: string; customer?: { number?: string } };
  customer?: { number?: string };
  artifact?: {
    transcript?: string;
    messages?: Array<{ role?: string; message?: string; content?: string }>;
  };
  endedReason?: string;
  summary?: string;
  status?: string;
}
