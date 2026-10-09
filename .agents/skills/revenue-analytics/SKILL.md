---
name: revenue-analytics
description: Build financial reports for flower sales, collections, refunds, costs, profit and receivables. Use for finance aggregates and exports; do not label order totals as collected cash or profit.
---

# Revenue analytics

## Scope and definitions

Read existing payment semantics and BU-14/18. Agree which date basis a report uses: placement, delivery or collection. Keep VND as integer amounts; define refund/discount recognition before adding totals.

- Gross sales, discounts, net sales, collected payments, refunds and outstanding receivables are different measures.
- Gross profit requires recognized product/fulfillment costs; net profit also requires operating expenses. Missing cost records mean unavailable profit, not zero costs.
- Do not double count retries, partial collections, repeated status events or refunded amounts. Use immutable financial events with unique operation IDs when partial events are implemented.
- Exclude sandbox data from real finance and apply branch/role scope at the server. Exports omit unrelated contacts/messages.

## Workflow and architecture

Write measure definitions and example reconciliation first. Build bounded database aggregate/RPC queries and connect filters/export. Snapshot actual ingredient/cost amounts from fulfillment records; never reconstruct old margins using current catalog prices.

## Validation and tests

Use fixtures with pending, COD collected, transfer unverified, canceled, partial paid/refunded and test orders. Reconcile each measure to ledger entries, check timezone/date edges and actor scope. Explain unsupported measures instead of displaying invented numbers.

## Failure and recovery

Show report errors/staleness without replacing totals with zero. Correct ledger errors through compensating entries and recompute aggregates; do not adjust the report alone to hide a mismatch.
