# Security policy

## Scope

This repository is a technical-assessment system for synthetic patient data. It is not approved for protected health information, clinical use, or HIPAA-regulated workloads.

Only the current `main` branch is maintained. Report security concerns privately to the repository owner or assessment contact; do not include credentials, real patient data, or exploit details in a public issue.

## Credential handling

- Keep Worker secrets in Cloudflare Secrets.
- Keep Vapi credentials in a private local environment or secret manager.
- Never commit `.dev.vars`, `.env.production.local`, API keys, webhook secrets, provider keys, private keys, or service-account files.
- Dashboard reviewers should create their own account. Share the application `API_KEY` only when direct REST write testing is required. Never share `VAPI_API_KEY` or `VAPI_WEBHOOK_SECRET`.
- Rotate a credential immediately if it appears in source control, logs, screenshots, chat, or email.

The CI security check rejects common credential files and secret formats, but automated scanning is not a substitute for reviewing staged changes.

## Account handling

- Passwords are stored only as salted PBKDF2-SHA-256 hashes.
- Browser sessions expire after eight hours; only token hashes are stored in D1.
- Session cookies are HttpOnly and SameSite=Strict, and add Secure on HTTPS.
- Account sessions are read-only for registry data. Patient writes and deletes still require the machine API key.
- Open registration is for this synthetic assessment only. There is no email verification, recovery, MFA, role model, or tenant isolation.

## Data handling

- Use synthetic identities and contact information only.
- Voice transcripts and call summaries may be stored in D1 even though audio recording is disabled.
- Do not enter symptoms, diagnoses, Social Security numbers, payment cards, or real insurance identifiers.
- Production healthcare use requires a separate compliance, privacy, architecture, and vendor-contract review.
