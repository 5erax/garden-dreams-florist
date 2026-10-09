# Production storefront update

09/10/2026: owner requested deployment after seeing the protected preview. This release ports the compatible storefront improvements to the current production code rather than shipping a staging backend dependency that production cannot satisfy.

Read-only public API verification confirmed the intended production project, readable shop settings and `accepting_orders=false`. `gd_environment` is absent (`PGRST202`), so the staging backend/Store changes requiring migration 005 are excluded. No SQL was run on production.

Included: collection readability/Standard price label/touch/focus improvements, product gallery with legacy cover fallback, detail subtotal and larger/wrapping controls, current-catalog selection, cart helpers and optional size snapshot presentation/payload support. The existing production Store does not load additional variants; new variant administration/ordering and image upload are not activated here. Standard-size checkout remains the existing production contract.

Production keeps its existing backend/Store/Auth/admin implementation and migrations 001–004. The full staging update remains in draft PR #1 until its hosted migration/QA gates pass. The shop remains closed for orders; deploying the storefront does not authorize opening sales.

Validation: this release branch's complete suite passes 26 tests; production build passes. The built bundle contains the intended production public endpoint and excludes staging. Deployment/project/commit/domain verification is recorded in tasks/progress.md after release. Browser interactions, SMTP, banking-app QR and migrations 005–008 remain outside this deployment's acceptance. The existing approximately 671 kB JS chunk remains a performance limitation.

The project skill/roadmap/audit/task documents are retained so the installed project-skill links keep working across the release and staging branches. Their staging verification history does not imply that those backend changes are released here.

Environment files and synthetic `.backups/` are ignored and excluded from the release. No dependency or infrastructure was added. Rollback target before this release: production deployment `dpl_BVtCLYnr1q4PXYqPgAfUDGWzUKDp`, main commit `c93b871aa6a5f8b720b2c2191e4f70c2a3f6bee9`.
