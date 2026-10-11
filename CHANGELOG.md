# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-11

### Added

- Natural-language voice intake through Vapi with interruption handling,
  English/Spanish switching, explicit readback, and confirmation before writes.
- Cloudflare Worker REST API with D1 persistence, CRUD operations, pagination,
  filtering, soft deletion, request IDs, and consistent response envelopes.
- Duplicate-patient detection, DOB-verified updates, database uniqueness
  constraints, and idempotent registration requests.
- End-of-call transcript and summary capture linked to successful registrations.
- Responsive dashboard with account signup, sign-in, HttpOnly sessions, account
  lockout protection, patient records, and recent call activity.
- OpenAPI 3.1 output, human-readable API documentation, health endpoint, and a
  guided reviewer landing page.
- Automated type checking, unit tests, credential scanning, dependency auditing,
  and Cloudflare deployment validation in GitHub Actions.

### Security

- Separate credentials for machine API access, Vapi webhooks, and dashboard
  password protection.
- Per-user password salts with a server-only authentication pepper.
- Prepared SQL statements, strict input validation, bounded request bodies,
  restrictive browser security headers, and origin checks for account actions.
- Recording disabled and prominent synthetic-data-only restrictions.

### Operations

- Production deployment on Cloudflare Workers and D1.
- Live inbound U.S. Vapi number connected to the production webhook.
- Release verification scripts for the public site, REST API, account flow, and
  Vapi configuration.

[Unreleased]: https://github.com/NihalAli19/carecloud-voice-patient-registry/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/NihalAli19/carecloud-voice-patient-registry/releases/tag/v1.0.0
