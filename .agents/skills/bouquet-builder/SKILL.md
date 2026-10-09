---
name: bouquet-builder
description: Design and implement bouquet recipes, ingredient quantities, size-specific recipes and custom bouquet quotes. Use when a bouquet must consume raw materials rather than only a finished-product count.
---

# Bouquet builder

## Scope and invariants

Recipe work is separate from catalog photos, marketing descriptions and additional selling sizes. Existing product/variant choices remain valid until a recipe feature is explicitly connected.

- Store recipe versions and lines with ingredient, amount and base unit. Flowers, wrapping and ribbons can all consume stock.
- Quantities cannot be negative or silently rounded between incompatible units. Use integer smallest units or explicit database numeric precision; avoid JS floating-point stock arithmetic.
- An order reservation snapshots the selected recipe version. Editing today's recipe does not rewrite reserved/fulfilled orders.
- Substitution requires the shop's policy and customer agreement; do not silently replace ingredients to satisfy inventory.

## Workflow

Inspect product/variant IDs and inventory units first. Define recipe validation and versioning in an additive migration, then connect admin editing and a server-side quote/reservation. Custom bouquet pricing needs an accepted quote/version/expiry; the customer's chosen materials do not authorize arbitrary prices.

## Validation and tests

Test duplicate lines, invalid units/amounts, missing ingredients, per-size recipes, version conflicts and editing a recipe after an order. A real reservation test must show deductions by ingredient, including packaging; adding an unused recipe table is not an implemented builder.

## Failure and recovery

Reject an incomplete quote/recipe before holding stock. Roll back all allocations together on failure. Preserve old recipe versions and distinguish a draft quote from an accepted purchase.
