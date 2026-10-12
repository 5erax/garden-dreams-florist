# Layout contract

Keep the existing cream/rose colors, fonts, initial transparent navigation and six falling petals. Layout changes must not change catalog facts, authentication, pricing, ordering or inventory rules.

- Storefront content uses one 1280px container with 40px desktop and 24px mobile gutters.
- The hero has two real grid columns, then stacks below 768px. Images and text must not overlap; avoid absolute positioning for primary content.
- Catalog has three desktop columns, two below 901px and one below 480px. Keep images, names, ingredients, prices and purchase actions readable. Do not add a fourth column to fit more cards.
- Collection has one compact heading; advanced filters start closed. All existing filtering remains available.
- The story anchor is an actionable ordering/delivery guide, not an image collage. Keep the legacy #story link working.
- Shop, garden, shared cards and customer account use the same ShopHeader, controls and dimensions. Mobile exposes three navigation links below the brand/action row. Admin keeps its separate workspace shell.
- When the real garden is empty, show 40 original Garden Dreams greeting suggestions derived from synthetic completed-order fixtures. Credit Garden Dreams, preserve real message privacy and keep fixture orders out of production transaction tables/revenue. Real public memories replace the suggestions once available.
- Admin uses a 208px sidebar and a flexible content area; below 901px use the existing mobile section selector. Report period/export controls start closed, with the current reporting period and numbers visible.
- Keep the single-scroll product modal, mobile order cards and persistent editor actions introduced by the report fixes.
- Edit the owning rules in design-polish.css rather than adding another stylesheet or a competing late override for the same layout.

Verify 320, 390, 600, 768, 1024 and 1440px, keyboard operation, no horizontal page overflow, no overlapping primary content, and unchanged transparent navigation/petals. Admin browser verification uses read-only synthetic data.
