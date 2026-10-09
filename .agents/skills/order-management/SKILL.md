---
name: order-management
description: Implement flower order creation, lifecycle, change requests, cancellation, history and fulfillment events. Use when order transitions or customer tracking change; keep payment reconciliation in its own module.
---

# Order management

## Scope and invariants

Read current order RPC/status transitions, event visibility and snapshots before adding a new state. Reuse existing optimistic version checks and idempotency rather than a parallel order service.

- An order belongs to its authenticated customer. Admin access is server-authorized; guessing IDs must not reveal contacts, messages or events.
- Creation computes prices/fees from current configuration and stores line/cỡ/SKU/delivery/payment snapshots. A retry cannot rewrite them.
- A customer's cancellation request is not a completed cancellation. Only allowed transitions update state and related reservations transactionally.
- Internal notes and public timeline events are distinct. Delivered+paid real orders create one memory; refunds/revoke follow the existing visibility rules.

## Workflow

Define permitted actor/status/version transitions and event output first. Extend one RPC/migration with connected admin/customer actions. Keep timeline queries bounded by cursor and stable ordering; do not fetch all orders to filter in React.

## Validation and tests

Test cross-user access, invalid transitions, duplicate/stale actions, retry after ambiguous success, changes after fulfillment and old-order rendering. Verify reservation changes roll back with the order on failure and public tracking excludes internal notes.

## Failure and recovery

Keep drafts on network failure, query the saved request/order before issuing a new operation, and show a conflict rather than overwriting newer changes. Recovery appends corrective events; it does not delete order history.
