---
name: flower-inventory
description: Implement perishable flower batches, stock movements, reservations, spoilage and ingredient availability. Use for physical inventory and freshness; do not treat product availability flags as an inventory ledger.
---

# Flower inventory

## Scope and rules

Track ingredients, units, batch arrival/expiry, supplier, branch when present and actual acquisition cost. Keep inventory movements auditable; corrections are compensating movements rather than edits to historical quantities.

- Available stock is on-hand minus active holds. Expired/wasted stock cannot be promised for delivery.
- Allocate FEFO among batches usable on the requested fulfillment date, using the shop's freshness policy. Do not invent shelf life from flower names.
- Check and allocate under a database transaction/lock; concurrent reservations cannot make available stock negative.
- Order+allocation+operation identities make hold, release and consume idempotent. Cancellation releases only active holds; fulfillment consumes exactly once.

## Workflow

Establish units and stock transitions before UI totals. Add batch/movement schema and RLS/RPC, connect receiving/adjustment admin and recipe reservations. Separate movement/audit scope from customer-facing availability. Reuse existing order idempotency and versions.

## Validation and tests

Test two holds racing for the last stems, expired batches, future delivery, damaged stock, partial allocations, repeated release/consume and transaction rollback. Totals must reconcile against movements; a local test does not prove hosted concurrency. Record batch expiry interpretation and cost rounding.

## Failure and recovery

Reject shortages without partial hidden reservations. Roll back failed allocations and report the ingredient shortage to authorized staff. Reconcile holds with orders before any cleanup; never erase movements to fix a displayed count.
