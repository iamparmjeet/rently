# Handover — 2026-08-26 18:30 — model: muse-spark-1.2 — branch: fix/beta-bugfix-audit-2026-08-26

## Done
- 13 pushes `1976ada..7d875d7` + follow-ups `e552e55` `fdd5dee` `91a933c` `dfa6a30` `210b903` — S1-S10 + Option-A provisional (`invite-service.ts:130` creates user/profile id=invite.id for owner_prepared, backfilled 01a03a6a Parm Tenant) + payment extendable + lease error + LCP + tenant pending fallback + pending docs 200. `check-types 6/6` each. `TODO.md:56` M1a now owner hard / tenant soft auto-verified `invite.ts:423`.
- `docs/Bug-2026-08-26-beta-audit.md` 10 slices + `docs/Constraints.md` github-centric (no local wrangler push, R2 separate) + `docs/beta-smoke-test.md:18` Aadhaar blocked + `.github/workflows/ci.yml`.

## In-progress
- **C+A hybrid** `blur` optimistic + `XHR putWithProgress >2MB` + `Button` spinner `isPending` — tenant hook `use-tenant-documents.ts:22` has `putWithProgress`, `docs-tab.tsx:174` has `uploadProgress` state + `onProgress` but `blur` card render for tenant + owner `documents-tab.tsx:136` `fetch PUT` → `putWithProgress` not yet pushed — you are not seeing hybrid because still local.
- **Owner Delete pending docs** `DELETE /rent/tenant-document/delete` where status in (upload_pending, pending_review, awaiting_tenant_consent) + R2 delete + `Button Delete` `documents-tab:246` pending.

## Broken / Excluded
- R2 private bucket `TODO.md:127-128` `r2 bucket cors list` etc — separate infra ticket per owner, not this branch.
- `AADHAAR_UPLOADS_ENABLED=false` beta default `wrangler.json:23` + `env/server.ts:44` — to test Aadhaar set true in **both** `.env` and `wrangler.json` vars then restart `bun run dev:server`. Capabilities cached until restart.
- Pending invite `01a03a6a` now provisional profile exists, `DocumentsTab` shows pending banner + `Upload on behalf` for PAN (Aadhaar still gated). Owner can now upload/lease/email/whatsapp while pending (Option-A).

## Avoid
- Do not batch slices; one commit per fix; no emoji after 2026-08-26 20:00 per owner.
- Do not mutate `utilities.totalAmount` — use `bill_credits`; do not hard delete `bill_credits` — use `+abs` reversal.
- Do not push R2 CORS via wrangler from local.

## Next session — exact first action
1. Finish `C+A` owner `documents-tab.tsx:136` `putWithProgress` + tenant `docs-tab.tsx:174` `blur` card render when `uploadProgress !== null` (optimistic `opacity-60 blur-[0.5px]` + progress bar `width: ${pct}%`), `Button` `disabled={isPending||uploadProgress!==null}` spinner, `clearPreviewCache` on unmount.
2. Add `deleteTenantDocument` `ownerProcedure` `DELETE /rent/tenant-document/delete` `where ownerId + status in (...)` + `R2 deleteObject` + `deletedAt`, UI `Button Delete` for pending docs.
3. `bun run check-types && bunx biome check . && bun run build` + `git push` as two single commits (no emoji), then `bun run test` `rently_test` full + manual `beta-smoke-test.md` 1-19 with `AADHAAR true` in both env files after restart.
4. Open PR `fix/beta-bugfix-audit-2026-08-26 -> main`, attach `docs/Bug-..` + `TODO.md` active branch section.

## Branch context
- Base `b2ed822` (main). Branch `fix/beta-bugfix-audit-2026-08-26` `origin` has `c7e8066` todo restore + `dfa6a30` pending fallback + `210b903` pending docs + `7d875d7` provisional + follow-ups to `210b903`. `docs/` gitignored — `TODO.md` is merge truth, `docs/Bug-*` via `git add -f` when shipping PR. Root `Handover.md` mirrors this for github.
