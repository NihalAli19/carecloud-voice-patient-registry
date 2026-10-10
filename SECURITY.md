# Security policy

## Scope

This repository is a technical-assessment system for synthetic patient data. It is not approved for protected health information, clinical use, or HIPAA-regulated workloads.

Only the current `main` branch is maintained. Report security concerns privately to the repository owner or assessment contact; do not include credentials, real patient data, or exploit details in a public issue.

## Credential handling

- Keep Worker secrets in Cloudflare Secrets.
- Keep Vapi credentials in a private local environment or secret manager.
- Never commit `.dev.vars`, `.env.production.local`, API keys, webhook secrets, provider keys, private keys, or service-account files.
- Give reviewers only the application `API_KEY`. Never share `VAPI_API_KEY` or `VAPI_WEBHOOK_SECRET`.
- Rotate a credential immediately if it appears in source control, logs, screenshots, chat, or email.

The CI security check rejects common credential files and secret formats, but automated scanning is not a substitute for reviewing staged changes.

## Data handling

- Use synthetic identities and contact information only.
- Voice transcripts and call summaries may be stored in D1 even though audio recording is disabled.
- Do not enter symptoms, diagnoses, Social Security numbers, payment cards, or real insurance identifiers.
- Production healthcare use requires a separate compliance, privacy, architecture, and vendor-contract review.
