# Constraints (2026-08-26 — fix/beta-bugfix-audit-2026-08-26, github-centric)

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
