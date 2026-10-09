---
name: flower-commerce
description: Implement flower-store purchasing and coordinate catalog, order, delivery and memory modules. Use for end-to-end flower commerce changes; route specialized stock, recipe or finance work to its own module.
---

# Flower commerce

## Scope and rules

Audit the actual repository and release state before changing it. Garden Dreams currently uses React/Vite and Supabase PostgreSQL/RPC/RLS; preserve that stack unless a requested change needs another. Read `FLOWER-COMMERCE-ROADMAP.md` and `tasks/todo.md` in this repository for module boundaries and unresolved gates.

- Prices, fees, permissions and state transitions belong on the server. Cart is a choice of IDs/quantity, not authority for money.
- COD/VietQR is manually reconciled by an authorized operator. A customer claim or QR display never means paid.
- Preserve immutable order snapshots and idempotency. A delivered, paid real purchase gets one memory; sharing is voluntary and only the chosen message/signature is public.
- Local/demo/staging traffic must not enter real sales or memory counts. A build or deployment does not establish hosted acceptance.

## Workflow and validation

Trace the requested slice through catalog → cart/quote → order → history/admin before editing. Reuse current helpers/RPC/capability flags, preserve old clients/catalog and test the changed invariant. Prefer one additive migration and its connected UI over a speculative full platform.

Verify an order retry, stale quote, unavailable selection and cross-user denial where relevant. Run focused checks and the applicable suite/build; report pending hosted/browser steps honestly. Do not add payment, email, branch or inventory integrations merely because this skill exists.

## Failure and recovery

Keep entered choices on request errors; distinguish a saved order from an unsent draft. Retry with the same request ID only for the same content, look up history after ambiguous success, and never reset a populated database to recover a rollout.
