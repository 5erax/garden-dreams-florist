---
name: ecommerce-security
description: Review and harden flower-commerce trust boundaries, RLS, order money, uploads and private gift messages. Use for security-sensitive commerce changes and permission audits, rather than every cosmetic UI edit.
---

# Ecommerce security

## Scope and invariants

Map actors and sensitive fields before editing policies. Existing Garden Dreams keeps bearer tokens in memory, public configuration in frontend and privileged decisions in PostgreSQL/RPC. Inspect actual code rather than assuming a service-role backend exists.

- Clients cannot authorize roles, prices, paid status, branch scope or public-memory visibility. Security-definer functions need explicit actor checks and restricted search paths.
- Private contacts/messages and public opt-in excerpts are separate outputs. Revocation must block new reads across all served endpoints/caches; do not promise removal of copies recipients already downloaded.
- Uploads have trusted destinations, size/type limits, fresh names and actor-scoped policies. Product-image buckets are never repurposed private customer storage.
- Staging/test data stays out of production counts. Never commit credentials, token links, addresses or customer fixtures from production.

## Workflow and validation

Trace changed input → validation → transaction/RLS → response/cache/log. Reuse current validation and rate/idempotency boundaries. Write adversarial tests for two users, anon and relevant staff; include direct table/RPC access rather than only UI hiding.

For sensitive changes verify price tampering, stale authorization, cross-user IDs, upload policy, replay and revoke races as applicable. Check error/log content and backup/export permission. Do not broaden policies to make a failing feature appear functional.

## Failure and recovery

Fail closed on environment or authorization mismatch, preserve recoverable audit/snapshots and scope any credential rotation to the affected service. Report unverified hosted policies separately; permission denial is not authorization to try another access path.
