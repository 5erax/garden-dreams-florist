---
name: multi-branch
description: Implement branch-scoped flower inventory, staff access, delivery fulfillment and reports. Use when expanding beyond one shop; avoid adding branch infrastructure to unrelated single-shop UI changes.
---

# Multi-branch

## Scope and invariants

Garden Dreams is currently single-shop. Introduce branch scope with a migration plan for old rows/clients rather than assuming empty data or attaching a browser-selected branch to all queries.

- Membership/role on the server determines branch access. Changing a client filter cannot grant another branch's contacts, stock or financial reports.
- Orders have an explicit fulfillment branch and historical assignment events. Reassignment moves holds atomically or fails entirely.
- Stock/slot capacity is per branch; transfers have paired source/destination movements and retry identities.
- Shop-wide owners and branch staff have different permission scopes. Preserve a recoverable owner role; staff cannot self-promote.

## Workflow

Define the requested branch roles and transfer/reassignment policies. Add a default branch/backfill and verify old-client compatibility, then scoped RLS/RPC, assignment UI and aggregate reporting. Do not combine this migration with a wholesale frontend rewrite.

## Validation and tests

Use staff in two branches and an owner; test hostile branch IDs, aggregate leaks, transfers/retries, last-stock races and reassignment rollback. Validate all preexisting orders have meaningful branch history before enabling scoped queries.

## Failure and recovery

Reject cross-branch operations without partial movements. Keep migration reversible where possible and audit transfers/reassignments. Do not recover a broken policy by granting broad client access.
