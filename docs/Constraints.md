# Constraints (2026-09-02 — feat/multi-unit-lease-agreements)

## Current feature constraints

- MUST: preserve existing lease/payment historical amounts, IDs, receipt routes, ownership, and audit timestamps through the migration.
- MUST: treat `lease_agreements` as the owner of tenant/property/shared terms; unit leases own rent, deposit, unit, and unit lifecycle.
- MUST: derive residential/commercial category from trusted unit data; never accept it from the client.
- MUST NOT: mix property or residential/commercial category in combined agreement creation.
- MUST: create agreement/lease and future payment group/allocation writes atomically in both Neon batch and callback-transaction paths.
- MUST NOT: make `leases.agreementId` or `payments.paymentGroupId` required before compatibility writers and backfills populate them.
- MUST NOT: use nullable grouping as the final accounting shape; every payment allocation eventually belongs to exactly one group.
- MUST NOT: delete or overwrite historical financial records; reversals are new auditable records.
- MUST: keep legal-document generation, private uploads, and e-signing out of this feature slice.

## Historical constraints

- MUST: only the property owner who owns the bill's lease/property may create a discount (`isLeaseOwner` in `credit.ts` + `utility.ts`).
- MUST NOT: grant property-management write access to supervisory `admin` role.
- MUST: retain immutable record of discount's amount, reason, actor, time — `bill_credits` never delete, `reversedAt` + `reversesCreditId` audit (like `payment.ts:274`).
- MUST: keep `utilities.totalAmount` immutable; adjustments via `bill_credits` only (GST-safe). `updateUtility:214` blocks financial edits when `gstEnabled||payment||credit`; electricity/water locked 0% in UI.
- MUST: verify `AADHAAR_UPLOADS_ENABLED=false` default (`packages/env/src/server.ts:44`, `wrangler.json:23`) and enforce per-type in `tenant-document.ts:89,284` — Aadhaar path returns `AADHAAR_UPLOAD_DISABLED` when flag false; non-Aadhaar (PAN, etc.) must still work. No R2 CORS mutation in this branch.
- MUST NOT: mutate R2 private bucket `keyhq-private-documents` CORS/policy from local `wrangler` in this branch — R2 operational checks (`TODO.md:127-128` `r2 bucket cors list`, unauth denial smoke) are separate infra ticket. Local `wrangler dev --remote` and manual `curl -H Origin` checks allowed for VALIDATION only, not for `wrangler r2 bucket cors set` / `wrangler deploy`.
- MUST: github-centric delivery — CI is source of truth (`.github/workflows/ci.yml`: `bun install` → `check-types` 6/6 → `biome` → `build` 5/5 → `vitest` against `rently_test`). No `wrangler publish`/`deploy` from local. Branch `fix/beta-bugfix-audit-2026-08-26` merges to `main` via PR after S1-S7 green.
- MUST: one ship-loop slice per change — no batching `payment.ts` + `credit.ts` + UI in one commit. Each slice has rollback: `git revert <sha>` or `git restore <files>` + re-verify `check-types` + relevant test.
- MUST: `TODO.md` is merge-visible source of truth; `docs/` is gitignored — `Handover.md`/`Bug-*.md` are local trace unless `git add -f`. Root `Handover.md` is the github-visible mirror when needed.
- Soft launch: `main@b2ed822` (post `feat/account-linking-security` `6489ee1`), branch `fix/beta-bugfix-audit-2026-08-26`. Rollback base `b2ed822`. No external customers — owner self-test.
