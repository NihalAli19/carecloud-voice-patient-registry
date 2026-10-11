# Deployment and rollback runbook

This runbook covers the assessment deployment on Cloudflare Workers, D1, and Vapi.
It is designed to make releases repeatable without placing credentials in source
control.

## Preconditions

- The release commit is reviewed and CI is green.
- `wrangler.toml` targets the intended Worker and D1 database.
- Cloudflare contains `API_KEY`, `AUTH_PEPPER`, and `VAPI_WEBHOOK_SECRET` as
  encrypted Worker secrets.
- The operator has authenticated Wrangler and has a tested rollback commit or
  Cloudflare version available.
- Only synthetic data is used during verification.

## Release sequence

1. Install exactly the locked dependencies and rerun the release checks:

   ```bash
   npm ci
   npm run check
   npm audit --audit-level=high
   npx wrangler deploy --dry-run
   ```

2. Review pending D1 migrations before applying them:

   ```bash
   npx wrangler d1 migrations list carecloud-patient-registry --remote
   npm run db:migrate:remote
   ```

   D1 schema changes must be backward compatible with the currently deployed
   Worker. Destructive migrations require a separate backup and recovery plan.

3. Deploy the Worker:

   ```bash
   npm run deploy
   ```

4. Verify public behavior:

   ```bash
   PUBLIC_BASE_URL=https://carecloud-voice-patient-registry.nihalaliytt.workers.dev npm run verify:public
   ```

5. Complete the account, API, and voice scenarios in
   [TESTING.md](TESTING.md). Remove any synthetic records created specifically for
   release validation.

6. Confirm Cloudflare logs show no new error pattern, then create the annotated Git
   tag and GitHub Release.

## Rollback

Application rollback and database rollback are deliberately separate operations.

1. If only Worker code is faulty, select the last known-good deployment in
   Cloudflare Workers **Deployments** and roll back to that version. Alternatively,
   redeploy the last known-good Git commit.
2. Re-run `/health`, public verification, and one read-only dashboard check.
3. Do not automatically reverse a D1 migration. Restore or migrate forward using a
   reviewed recovery plan because newer writes may depend on the new schema.
4. If Vapi behavior caused the incident, detach the phone number from the affected
   assistant or restore the last known-good assistant configuration.
5. Record the incident, impact window, rollback version, validation evidence, and
   follow-up action in the pull request or release notes without exposing secrets or
   patient data.

## Post-release evidence

Capture these identifiers in the release or submission notes:

- Git commit and version tag
- GitHub Actions run URL
- Cloudflare Worker version ID
- API base URL and health status
- Vapi assistant/phone verification status
- Migration status and any known limitations

Never paste API keys, webhook secrets, authentication peppers, provider tokens, or
real patient information into release evidence.
