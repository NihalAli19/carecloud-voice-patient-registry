# Test plan

This plan separates automated checks, API behavior, and real telephony validation. Use synthetic data only.

## 1. Automated release checks

From the repository root:

```powershell
npm install
npm run db:migrate:local
npm run check
npm audit --audit-level=high
npx wrangler deploy --dry-run
```

Expected result:

- TypeScript compiles without errors.
- All unit/security tests pass.
- The tracked-file credential scan passes.
- `npm audit` reports no high-severity vulnerabilities.
- Wrangler produces a Worker bundle without deploying it.

## 2. Local application test

Ensure `.dev.vars` contains unique development values for `API_KEY` and `VAPI_WEBHOOK_SECRET`, then run:

```powershell
npm run dev
```

Open these URLs:

- `http://localhost:8787/`
- `http://localhost:8787/health`
- `http://localhost:8787/dashboard`
- `http://localhost:8787/docs`
- `http://localhost:8787/openapi.json`

Acceptance checks:

- The overview explains the call-to-dashboard journey, displays the synthetic-data warning, and provides clear Sign in and Create account paths without internal status or API-documentation UI.
- Health reports `ok` and `database: connected`.
- The dashboard reports the real service status rather than a static success label.
- A reviewer can create an account, sign out, and sign back in; invalid credentials are rejected.
- Account sessions can read registry data but cannot create, update, or delete patients.
- An invalid machine API key is rejected.
- Sign out deletes the server session, clears the HttpOnly cookie, and returns to the overview.
- Patient filters and row details work at desktop and mobile widths.
- Recent calls are displayed without transcript content.

## 3. API smoke test

Set credentials in the current shell without printing them:

```powershell
$env:PUBLIC_BASE_URL = "http://127.0.0.1:8787"
$env:API_KEY = "your-local-api-key"
$env:VAPI_WEBHOOK_SECRET = "your-local-webhook-secret"
npm run smoke:api
```

The API smoke suite verifies machine authentication, malformed paths, payload limits, creation, idempotent replay, idempotency conflicts, duplicate prevention, updates, soft deletion, phone reuse, Vapi authentication, DOB-protected lookup/update, and call-report persistence.

For the browser-account lifecycle, point `PUBLIC_BASE_URL` at the local Worker and run `npm run smoke:auth`. It verifies signup, duplicate prevention, cookie sessions, read-only access, write denial, signout, and signin. It leaves one synthetic account in local D1; do not run it against production unless that test account is intentionally retained.

The suite creates only synthetic records and soft-deletes its patients. Use a disposable local database for repeated development runs.

## 4. Production public checks

```powershell
$env:PUBLIC_BASE_URL = "https://carecloud-voice-patient-registry.nihalaliytt.workers.dev"
npm run verify:public
```

Expected result: simplified overview journey, anonymous account gate, health, database connectivity, dashboard account forms, hidden legacy API-key UI, documentation endpoints, OpenAPI, HSTS, CSP nonces, anti-framing, and no-store checks all pass.

## 5. Real phone test

Call `+1 864-625-5246` with a regular telephone. International carrier charges may apply.

### Scenario A: new registration

Use this synthetic record:

- Name: Alex Morgan
- Date of birth: 04/15/1988
- Sex: Decline to Answer
- Phone: 202-555-0147
- Address: 100 Test Avenue
- City: Washington
- State: DC
- ZIP: 20001

Expected behavior:

1. The agent states that this is a demonstration.
2. It asks one focused question at a time and accepts corrections.
3. It reads the complete record back.
4. It does not write until it receives an explicit confirmation.
5. It reports success only after the write tool succeeds.
6. The patient and ended call appear in the dashboard.

### Scenario B: verified duplicate update

Call again using phone `202-555-0147` and DOB `04/15/1988`.

Expected behavior:

1. The agent detects the existing record.
2. It offers an update instead of creating a duplicate.
3. It asks for DOB again before the final update.
4. Change the address to `200 Test Avenue`, confirm the readback, and verify that the existing patient changes without creating another active record.

### Scenario C: failed identity verification

Call with phone `202-555-0147` but give an incorrect DOB.

Expected behavior:

- The agent does not reveal the stored patient's name, ID, or demographics.
- It does not create or update a record.
- It directs the caller to contact the clinic.

### Scenario D: conversational recovery

During a new synthetic registration:

- interrupt the agent;
- provide two fields together;
- correct a misspelled name or address;
- provide an invalid ZIP, then correct it;
- decline all optional fields.

Expected behavior: the agent recovers naturally, asks only for missing/invalid information, and performs one confirmed write.

## 6. Submission acceptance checklist

- GitHub CI is green for the submitted commit.
- The Vapi phone is active and assigned to the expected assistant.
- Vapi has enough credits for reviewer calls.
- Production D1 has no pending migrations.
- The reviewer can self-register for dashboard access; provide the application `API_KEY` privately only if direct REST write testing is requested.
- Vapi and webhook credentials are never shared.
- The submission clearly says “synthetic data only” and does not claim HIPAA compliance or an unsupported uptime SLA.
