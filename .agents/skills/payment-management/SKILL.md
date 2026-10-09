---
name: payment-management
description: Implement manual COD and VietQR reconciliation, refunds and payment ledgers for flower orders. Use for payment state or finance events; do not introduce an automatic payment gateway without a requested integration.
---

# Payment management

## Scope and invariants

The shop currently uses COD plus VietQR transfer with admin verification. QR generation is an instruction to pay, not evidence of receipt. Do not collect card credentials or convert this into gateway settlement.

- Only authorized staff confirm receipts/refunds with evidence, actor and timestamp. A customer screenshot/claim never directly sets paid.
- Amounts are integer VND from the server's order snapshot. Bank instructions are snapshotted; current bank configuration cannot rewrite an old order.
- Payment actions require operation identity/version and audit. Concurrent/repeated confirmations cannot create duplicate collected amounts.
- Partial receipts/refunds require explicit ledger/state definitions before enabling them. Marking a refund records reconciliation; it does not itself transfer bank funds.

## Workflow and validation

Trace order, bank config, QR payload, reconciliation RPC and memory eligibility together. Reuse current manual flow; add a ledger only when needed for actual partial events/reporting.

Test unauthorized paid/refund changes, amount bounds, repeated evidence/action IDs, stale versions and COD/VietQR transitions. Reconcile ledger totals to order balance and test refund effects on sharing. A QR encoding test does not prove acceptance by a banking app; record that separate check.

## Failure and recovery

After ambiguous confirmation, reload reconciliation history before retrying. Keep payment pending when evidence is insufficient. Use corrective audited entries, not deleted payment events, to resolve a mistake.
