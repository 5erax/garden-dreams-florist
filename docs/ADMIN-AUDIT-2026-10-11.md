# Admin and customer workflow release — 2026-10-11

Shop-confirmed hours: 08:00–17:00. Existing Zalo unchanged. Legal name and registration number remain empty until the owner supplies verified information.

## Delivered

- Consistent money, date, search, status and filter controls; explicit calendar activation and capacity/cutoff preview.
- Inventory expiry filters, units, minimum stock, pack conversion, supplier labels, recipe cloning and validated CSV import. Base recipe is authoritative for catalog composition. No stock was invented or inventory control enabled.
- Atomic closure ranges across delivery zones, protected against reservations; versioned single-day editing remains available.
- Operations quick confirmation, contact and printing; labeled buyer/recipient details, fulfillment progress and separate payment status. Contact retention includes the new buyer fields.
- Revenue presets, prior-period bookings, average booked order value and cancellation rate; chart labels and accessible values. Money remains based on checked receipts/refunds rather than order status.
- Searchable product table, bulk pause, inline prices, reorder, occasions, editable SEO slug, image upload/drop and alt text. New products start paused with blank price/photo; no borrowed photo.
- Consent-aware memory moderation, optimistic version checks, customer-visible reasons and public count excluding private/removed memories.
- Same-tab account restoration through sessionStorage, with signout clearing it. Device persistence remains restricted to explicitly remembered anonymous guests; cart isolation is unchanged.
- Official VietQR bank list and explicitly labeled 1,000 VND QR preview. Preview does not verify account holder identity or transfer money.
- Public product titles identify flower composition. Former bo-hoa-ID URLs redirect when a custom slug is saved. Returns policy is editable and displayed in the existing footer policy dialog.

## Returns policy

Wrong bouquet, missing flowers or damage at receipt: contact the shop with order reference and photos promptly, preferably on receipt day, so the shop can verify and agree replacement or the corresponding refund. Schedule/address/cancellation changes need confirmation before production; additional fees require customer agreement. Seasonal substitutions require advance agreement. Refunds are transferred through an agreed method and then recorded; the website does not itself transfer money. This guidance does not waive statutory consumer rights.

## Validation and limits

187 tests passed in the full suite, followed by three additional UI checks (190 passing checks total). The audit tests cover CSV/calendar boundaries, tab-session isolation, buyer retention, recipe authority, private RPC guards, moderation/versioning, reordering and closure rollback. Production build validates private template, 21 sitemap URLs, 40 product pages and three catalog-outage routes. Both production and staging builds passed. UI checks additionally cover money validation, cancelled progress and explicit catalog controls.

Real browser/layout, Core Web Vitals and indexing remain unverified because browsing permission is blocked. Main bundle still exceeds the Vite size advisory.

## Not completed / operational requirements

- HttpOnly/SameSite cookie authentication and 30-day persistence, Google/Zalo/OTP sign-in require a separate auth implementation and provider configuration; current tab sessions are not those cookies.
- Customer self-service schedule/address repricing and fee consent, automated notification delivery, named staff profiles and on-time reporting remain separate work.
- Real ingredient quantities, recipes, suppliers/costs, genuine reviews/photos and registration information must come from the shop. Hours are shown; delivery acceptance remains governed by server slot/capacity/cutoff settings, not an automatic daily 08–17 storefront lock.
- Receipt/refund actions record externally verified money and never initiate bank transfers. Bulk pause reports partial completion if any row version conflicts.
- Product stock warnings use the latest 200 loaded batches and are explicitly labeled with that scope. Configure real stock before enabling inventory control.
