# Contributing

This repository is maintained as a technical-assessment project. Contributions
must preserve its synthetic-data-only boundary and pass the same controls used
for a production release.

## Development workflow

1. Start from an up-to-date `main` branch.
2. Create a focused branch using one of these prefixes:
   - `feature/` for user-facing capabilities
   - `fix/` for defects
   - `security/` for hardening
   - `docs/` for documentation-only changes
   - `release/` for release preparation
3. Keep commits small and describe the outcome in the imperative mood. Conventional
   prefixes such as `feat:`, `fix:`, `security:`, `docs:`, and `chore:` are encouraged.
4. Never commit credentials, production exports, real patient information, or local
   environment files.
5. Open a pull request using the repository template and wait for CI before merging.

## Required local checks

```bash
npm ci
npm run check
npm audit --audit-level=high
npx wrangler deploy --dry-run
```

Run the relevant smoke tests from [docs/TESTING.md](docs/TESTING.md) when a change
affects HTTP behavior, authentication, persistence, telephony, or deployment.

## Review expectations

- Explain the user or operational impact.
- Identify database, API, configuration, and security changes explicitly.
- Include reproducible validation evidence.
- Document rollout and rollback steps for production-affecting changes.
- Keep unrelated formatting or refactoring out of functional pull requests.

## Merge and release policy

- `main` must remain deployable.
- Merge only after required CI checks pass.
- Use a merge commit for release PRs so the release boundary remains visible.
- Tag approved releases using semantic versions; do not move or reuse published tags.
- Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment, verification, and rollback.

## Responsible data handling

Use synthetic identities only. Do not submit protected health information,
credentials, call recordings, private transcripts, or production database data in
issues, pull requests, commits, screenshots, or logs.
