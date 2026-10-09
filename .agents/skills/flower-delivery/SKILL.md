---
name: flower-delivery
description: Implement flower delivery zones, calendars, cutoff times, slot capacity and fulfillment assignments. Use for scheduling and delivery reservations rather than generic shipping labels.
---

# Flower delivery

## Scope and invariants

Inspect current `gd_shipping`, order delivery snapshots and BU-10–15 before replacing any choice. Use the shop's configured regions, fees, holidays and policies; do not invent real service coverage.

- Interpret dates/cutoffs in Asia/Ho_Chi_Minh. A selectable slot must satisfy service, day, cutoff and capacity rules on the server.
- Confirmation holds capacity atomically. Cancel/reschedule releases or exchanges the hold once, including retries and stale versions.
- Price/region/date/time promised on the order remain historical snapshots; config changes affect new quotes.
- Delivery personnel get only assigned delivery data needed for fulfillment and cannot confirm bank payment or see private messages without a business need.

## Workflow and architecture

Implement calendar/slot validation before reservation transitions, then customer options and admin queues. Keep slot holds and order status updates in one transaction. Keep worker notifications in an outbox after commit, independent of the browser or hosting frontend.

## Validation and tests

Test midnight/cutoff boundaries, holiday closures, shop closed, capacity zero, simultaneous last-slot confirmation, reschedule/cancel retries and unauthorized assignment edits. Test failures/re-delivery without creating an extra memory.

## Failure and recovery

On a stale/full slot return a fresh choice without claiming confirmation. Preserve address drafts until policy permits deletion. Reconcile holds and order states; never release another order's capacity during recovery.
