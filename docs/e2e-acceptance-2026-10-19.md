# End-to-end acceptance — 19 October 2026

Scope: customer storefront, account/cart boundaries, order lifecycle, reconciliation, memories, inventory and production admin. Production business records were inspected without saving changes. Synthetic ordering/payment workflows ran against an ephemeral local database using all application migrations, with hosted staging checks rolled back.

## Repaired defects

- Account switching could leave checkout open with an empty account cart and shipping-only total. Checkout now returns to flower selection while preserving a same-owner pending request.
- Admin product creation failed because the invoker trigger could not execute the private slug normalizer. A grant on this pure text helper preserves product RLS.
- Hosted catalog identity sequences lagged behind explicitly seeded product IDs. The repair locks the table and advances to the greater of allocated sequence/product high-water marks, without rewinding.
- Recipe dirty tracking compared numeric and string representations differently after restoring a value. Request and snapshot now use the same canonical recipe.
- Inventory retry success lost its original form reference. It now marks only that form saved, including after an ambiguous response.
- Order detail reconciliation and request panels shared a sibling React key. Updating payment could duplicate reconciliation forms. Redundant outer keys were removed; inner order/user/role keys retain reset behavior.

## Evidence

- 227 automated tests passed; no failures or skips. New regression cases reproduced each changed behavior before the fix.
- Full optimized build passed: private SEO template, 40 product snapshots, 16 sitemap URLs, catalog outage routes and entry-size budget.
- Local SDK acceptance: authentication, catalog/variants, server prices, fee snapshots, idempotent retries, owner privacy, admin fulfillment/receipts, memories/share/revoke and settings audit.
- Local compiled UI: COD receipt; VietQR 430,000 VND order, 100,000 VND partial receipt, remaining QR 330,000 VND, final receipt and delivery; exactly one reconciliation panel after updates.
- Customer UI: delivered memory private by default, explicit link sharing exposes only card/signature/flower, revoked link no longer exposes the message; another account has empty history.
- Inventory UI: quantity 1 → 2 → 1 leaves no dirty warning; aborting the response after the recipe was actually saved, then retrying, leaves one version increment and a clean form.
- Hosted staging transactions: order creation/retries, COD/VietQR, receipt role checks, fulfillment, sharing/revocation, owner RLS; inventory FEFO, shortage rollback, reservation release, consume-once, receive/waste idempotency and ledger privacy. All business rows rolled back.
- Both corrective database migrations applied to staging and production. Hosted staging admin product insert then succeeded inside a rolled-back transaction.
- Production authenticated admin: all 10 sections loaded without alerts/console errors. Product draft navigation guard triggered; nothing was saved. Browser control then stalled at its native confirmation dialog; the temporary product-name draft may still need cancellation (Esc/reload).
- Production public mobile (390×844): product details and checkout entry rendered without document horizontal overflow. Guest and registered-account entry options displayed.

## Limits

No real bank transfer, refund, delivery, outbound email/SMS, password reset email, or production image upload was performed. Local transport is a limited loopback Supabase/PostgREST adapter, not a replacement for hosted Auth/Storage; hosted staging checks supplement it. Existing Supabase advisories remain for callable SECURITY DEFINER functions/anonymous-session policies and disabled leaked-password protection; advisor scans reported no ERROR notices. Role/privacy tests passed, but this is not a complete penetration test. The existing >500 KB bundle warning and previously measured throttled mobile LCP need separate performance work. No claim of zero undiscovered defects.
