---
name: customer-loyalty
description: Implement flower-store rewards, points and voucher redemption with server-validated balances. Use for an explicitly requested loyalty program; do not enroll customers or issue marketing automatically.
---

# Customer loyalty

## Scope and rules

Loyalty is not present in Garden Dreams yet. Obtain the actual earning/redemption/refund/expiry policy before assigning financial value or migrating balances. Keep loyalty consent separate from public-memory opt-in and order consent.

- Earn on the policy's completed/paid eligible events, excluding test orders. Retry creates one reward event, never extra points.
- Voucher applicability, limits and amount are validated on the server. The cart cannot choose its own discount.
- Redemption reserves/consumes/releases points transactionally with the order; refunds use the defined reversal policy.
- Private balances/history are owner-scoped; staff adjustments require a reason/audit. Program expiry has an explicit timezone/date rule.

## Workflow and architecture

Define a reward ledger and example balance calculations first. Connect quote/discount snapshot, checkout, account history and authorized adjustments in small slices. Avoid a mutable points counter without source events.

## Validation and tests

Test concurrent voucher usage, duplicate reward events, cancellation before settlement, refunds, expiry boundaries, hostile discount payloads and cross-user history. Ensure disabled programs preserve existing order discounts/snapshots.

## Failure and recovery

Rollback failed redemptions with the order; release only the matching reservation. Reconcile balances from events and append corrections. Do not silently erase expired or refunded history.
