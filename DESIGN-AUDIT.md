# Garden Dreams storefront audit

09/10/2026. Source audit for the collection polish requested through `design-taste-frontend` and `ponytail`. Browser inspection is unavailable; this is not visual acceptance of BU-04 or BU-26.

## Design read and preservation

Reading this as a flower storefront for gift buyers, with soft romantic photography and an editorial layout inherited from the reference template. Preserve the existing design rather than replace the brand.

Dials: DESIGN_VARIANCE 7, MOTION_INTENSITY 5, VISUAL_DENSITY 3. Keep the current asymmetrical hero, floral framing, restrained reveals and reduced-motion behavior. No additional animation or dependency.

- Palette: cream `#f8f3ee`, paper `#fffaf6`, ink `#392d29`, muted `#786963`, rose `#945064`. Retain the light palette as an explicit reference-preservation choice.
- Type: existing local Garden Serif and Garden Sans, with italic headings. Retain the assets and font loading behavior.
- Signature: bouquet photographs inside arched frames, hero video and petals, spacious section headings. Preserve these and the existing desktop/tablet/mobile column counts.
- Information architecture: existing collection, story, garden, account and cart entry points. Keep navigation, hash links, form names, payment behavior and legal copy.
- SEO baseline: Vietnamese document language, existing title/description and Open Graph image. Do not change these in this slice. Canonical URLs, product routes and structured data remain later SEO work.

## Smallest complete slice

Only `App.jsx` collection markup and its selectors in `styles.css` change. Product data, cart callers, order snapshots, migrations, fixtures, exports and environment configuration are unaffected. Existing money formatting and size selection stay in place.

1. Label the displayed product price as Tiêu chuẩn, matching the existing base-size contract. Do not claim it is the lowest variant price.
2. Make card metadata readable, allow long names/stem descriptions to wrap, and separate composition from the price row.
3. Bring collection filters, search, sorting, favorites and quick-add controls to at least 44 px height; use 16 px search text to avoid input zoom on mobile.
4. Keep the image button's keyboard focus inside its clipping frame. Preserve focus-within quick-add and touch/reduced-motion rules.
5. Consolidate only the duplicated card styles touched by this slice.

## Verification and remaining acceptance

Verified: full source diff and `git diff --check`; staging build passes. Native Node contrast calculation: ink/cream 12.04:1, muted/cream 4.76:1, rose/cream 5.30:1, ink/paper 12.81:1 and white/ink 13.28:1. These are solid-color calculations, not a rendered-page accessibility audit. Preview deployment verification is recorded in tasks/progress.md when available.

No new JS branch, money logic or security boundary is introduced; no new test harness is needed for static markup/CSS. Existing 36-test results belong to the prior business-logic change and were not rerun for this CSS slice. Build still reports the existing approximately 683 kB JS chunk warning; splitting is separate performance work.

Pending: real browser at 320/375/768/1440 px, keyboard/touch and long catalog content, image loading/hover states, actual rendered contrast, Lighthouse and dark-theme design. Existing hero copy and page-wide tiny typography need their own content/design slices. Admin, checkout and account remain outside this marketing skill's scope.

BU-26 remains unaccepted until its dependencies and browser checks pass. Preview build/READY alone cannot establish layout quality or accessibility.

## Product detail slice

The screen's job is to select an available size/quantity and understand the item subtotal before adding. Reuse the native size select, Quantity, Modal and `subtotal` helper. Derive the displayed total directly from the current catalog/choice; do not keep a second price state or assume shipping is included.

Keep the select visible when a selected size disappears, including the last additional size. Show its unavailable state and allow return to Standard; hide the unit price/subtotal while the choice is invalid, keep Add disabled. Keep the native dialog and existing focus return. Increase copy/control readability, allow actions to wrap on narrow screens, and contain scrolling in dialogs.

Review source: [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), fetched 09/10/2026. Applied relevant rules to this slice with native control semantics:

- `src/ShopDialogs.jsx`: size label/name/invalid state; derived subtotal with polite live status; no fallback unit price for an invalid choice.
- `src/styles.css`: native select font 16 px, product quantity buttons 44 px, wrapping actions, long-content wrapping and dialog overscroll containment.
- `src/ProductGallery.jsx`: explicit image dimensions remain follow-up debt; the gallery frame already reserves space. No image assets or gallery state changed in this slice.
- Whole-page autoplay pause control, browser focus/keyboard verification and Lighthouse remain pending; reduced motion remains supported in source.

Three new SSR markup tests pass: Standard/subtotal display, additional-size options and unavailable choice without a fallback price/enabled Add. They compile React without listening on an HTTP port or accessing hosted services. The existing cart tests check multi-size totals and unavailable variants. These tests do not simulate changing quantity/select or a live catalog refresh; those browser interactions remain pending. A mutation restoring the invalid fallback price failed the regression test; source was restored. Full suite: 39 passing; staging build passes with the existing approximately 684 kB JS chunk warning.
