## Summary

Describe the problem and the outcome of this change.

## Scope

- [ ] Application behavior
- [ ] API contract
- [ ] Database or migration
- [ ] Authentication or security
- [ ] Telephony or Vapi configuration
- [ ] Documentation or operations only

## Validation

- [ ] `npm run check`
- [ ] `npm audit --audit-level=high`
- [ ] `npx wrangler deploy --dry-run`
- [ ] Relevant smoke or manual tests completed

List the exact test evidence and any intentionally skipped checks.

## Deployment and rollback

Describe configuration changes, migration ordering, deployment steps, and the
specific rollback path. Write `Not applicable` only when the change cannot affect a
deployed environment.

## Security and data handling

- [ ] No credentials or local environment files are included
- [ ] No real patient data or protected health information is included
- [ ] New inputs and authorization boundaries were reviewed
- [ ] Logs and error responses do not expose sensitive values

## Reviewer notes

Call out trade-offs, known limitations, or areas that deserve extra attention.
