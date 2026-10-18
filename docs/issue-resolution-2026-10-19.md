# Remaining issue resolution — 19 October 2026

Scope: #10, #17–29, #31–45 (29 issues). Preserve the transparent initial navigation and falling petals. The owner scoped #10 to technical SEO and accepted editable seasonal bouquet descriptions for #24 without confirmed exact measurements.

## Verification

- `npm test`: 219/219 passed, no skipped tests. Tests include PGlite migrations, server money/authorization checks, checkout retries and component regressions.
- `npm run build`: SEO build contract and initial dependency budget passed. All static initial imports are counted once; dynamic checkout/QR modules are excluded because they load on demand.
- Production dependency audit: zero known vulnerabilities (`npm audit --omit=dev`).
- Chromium browser checks at 320 × 712, 390 × 844 and 1440 × 1000. No horizontal overflow at 320/390. Header is 88 px after scrolling, all occasion buttons visible. Desktop initial header background remains transparent; six decorative petals remain.
- Mobile product: gallery 212 px, purchase footer 181 px at 390 × 844; caption and text do not overlap, first ingredient value is fully above the footer. CSS overrides load after the existing polish styles.
- Garden: loaded all 40 suggestions, searched accent-insensitively, opened a card and returned to the same card/scroll position with all 40 retained. Clipboard fixture confirmed exact message copying and public card links without the current query string. Native share retains explicit copy-link fallback.
- Cart: opened the selected product/size from a cart line, returned with focus on that line, removed and restored a line with Undo.
- Checkout contact fixture: malformed phones produced linked errors; `090 123 4567` and `+84 90 123 4567` became `0901234567` and `+84901234567`. All backend traffic in this fixture was intercepted, including order submission; no order or payment was created.
- Admin fixture: real unsaved-form hook and variant editor against intercepted responses. Cancel navigation retains the draft; save failure retains dirty state; successful save clears it; beforeunload is prevented while dirty. No live admin changes were submitted.
- Additive `20261018185115_public_bouquet_specifications` migration applied to the existing staging and production backends. Both columns and capability flag verified; RLS retained. No sales, payments or inventory rows changed.

## Initial transfer budget (#25)

Same local demo build configuration and baseline `7fe9c41`, counting all static entry dependencies (raw bytes, separately gzipped JS files):

| Measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Initial JS | 896,010 | 667,256 | −25.5% |
| Gzipped initial JS | 268,882 | 197,546 | −26.5% |
| Initial CSS | 128,431 | 118,573 | −7.7% |

The final staging-configured build was 667,226 JS / 197,554 gzipped JS / 118,734 CSS bytes before the last CSS spacing adjustment. Exact build values vary slightly by environment and copy. Enforced ceilings are 700,000 JS, 210,000 gzipped JS and 160,000 CSS bytes. Vite's single-chunk 500 kB warning remains; the budget does not suppress it or hide dependencies in vendor chunks.

One cold-cache mobile lab run of the built local preview: Chromium, 390 × 844, CPU slowdown 4×, network latency 150 ms, download 200,000 B/s, upload 93,750 B/s. FCP 1,048 ms, LCP 9,596 ms, CLS 0.071. Local TTFB 15 ms is not production latency. The slow LCP includes contention from the initial server-rendered catalog images; this result does **not** establish a passing field CWV score or mobile LCP target. Production HTTP and a hosted lab measurement are recorded in the release verification after deployment.

## Issue evidence map

| Issue | Result and evidence |
| --- | --- |
| #10 | Technical SEO scope: deployed HTTP route/HTML/canonical/JSON-LD/robots/sitemap checks in release verification. Search Console excluded by owner. |
| #17 | UNPAID/PARTIAL VietQR uses authorized server receivable; zero, failure and retry tested in `bank-payment.test.js`, `remaining-correctness.test.js`. |
| #18 | Reference/unavailable robots policy survives private-route transitions; duplicate metadata removed; staging remains noindex. |
| #19 | Card price, budget and both sort orders use the same lowest active purchasable choice. Disabled sizes excluded. |
| #20 | Server-rendered product delivery copy defers to the configured checkout fee; no hard-coded free-shipping promise. |
| #21 | Shared phone normalization, field-linked errors, first-error focus and separated buyer/recipient autofill. |
| #22 | Favorites are scoped by environment/account; legacy ownerless IDs are discarded. Account changes hide prior IDs immediately. |
| #23 | Dirty product, variant, inventory and calendar forms protect navigation/reload/cancel; success alone clears baseline. |
| #24 | Bounded product/size specification fields, admin editing and public size-specific rendering; protected SQL permissions tested. |
| #25 | Lazy checkout and QR, payment component separated from order details, native decorative reveal; budget and lab measurement above. |
| #26 | Compact two-row mobile header; 104 px initially, 88 px scrolled; 44 px action targets. |
| #27 | Visible account/favorite/cart labels on mobile; desktop hover/focus tooltips. |
| #28 | Occasion buttons wrap and remain fully visible at 320 px. |
| #29 | Single live count distinguishes displayed/total results; load-more states remaining count. |
| #31 | Removable active-filter chips and clear-all remain visible outside the collapsed panel. |
| #32 | Validated shareable query parameters, refresh persistence and browser history; favorite IDs never enter URLs. |
| #33 | Reduced gallery and footer; real mobile geometry checked for ingredient visibility and caption separation. |
| #34 | Unavailable product offers a working collection next step without quantity/dead purchase controls. |
| #35 | Cart line opens selected product/size; closing returns to cart and restores line focus. |
| #36 | Undo restores removed quantity without duplicate lines; availability and cart limits retained. |
| #37 | Product quantities/subtotal and delivery-fee guidance remain visible at guest/login/signup checkout gates. |
| #38 | Guest guidance explains tab/remembered session and shared-device implications; remember remains opt-in. |
| #39 | Signup states 12-character minimum before submission and links it to the password input. |
| #40 | Mobile floating filter shortcut appears inside the catalog after toolbar scrolls away; hides for dialogs/keyboard. |
| #41 | Accent-insensitive search covers all 40 suggestions before pagination; real-memory search states loaded scope. |
| #42 | Garden remains mounted during card visits, preserving query, pagination, scroll and focused card. |
| #43 | Exact message copy plus selected-text fallback when clipboard is unavailable. |
| #44 | Native share, explicit link copy and public-link fallback; only public card token enters the URL. |
| #45 | Clearer input boundaries on cream backgrounds and visible focus/invalid states. |

## Limits

No live purchase, bank transfer, refund or real customer/admin write was performed. Synthetic checkout/admin responses are identified above. Google indexing and field CWV are not claimed. Bouquet measurements remain editable shop content; no exact measurements were invented. Existing shop receiving-order configuration was not changed.
