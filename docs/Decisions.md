# Decisions

## 2026-08-25 - occasional-discounts - Decision: full GST-safe discount before launch (supersedes draft-only) — shipped 8d32713

**Why:** `TODO.md:194` and `b6c7f5e` (main after beta2 merge) require rent+utility coverage with GST configurability, soft launch owner-only (no external customers). Keeping `utilities.totalAmount` immutable and adding separate `bill_credits` (`0016_gst_and_bill_credits.sql`) preserves GST immutability per `research/gst-occasional-discounts.md` s.15(3)(a)/34. Residential rent 0% exempt default prevents over-charging.

**Alternatives:** Draft-only discount on utilities (kept as Step 1 slice). Hardcode 18% rent GST.

**Tradeoff:** Larger surface: needs `bill_credits`, derived `amountDue`, Settings GST gate, credit-note numbering `KQ-CN-xxx`.

**Evidence:** `TODO.md:194`, `docs/research/gst-occasional-discounts.md`, `TODO.md:213` spec, `ea33b66..8d32713` 28 files. Reasoned with Muse Spark 1.2.

## 2026-08-25 - occasional-discounts S5/S6 + soft-launch merge — Decision: merge feat/utility-discounts → main (not beta2)

**Why:** Branch was cut from `main` at `b6c7f5e` after `beta2→main` merge; no real customers, owner self-tests soft launch. All slices `S1` DB, `S2` settings API, `S3` credit API, `S4` payment `amountDue`, `S5` bill UI, `S6` credit-note PDF + `tax-gst-tab` + `discount-dialog` + `updateUtility` guard are done and `check-types` green. Keeps `main` as soft-launch truth; `beta2` will be re-cut from `main` later.

**Alternatives:** `feat→beta2→main` (avoids main churn but adds stale `beta2` indirection; rejected — extra merge, no customers to protect).

**Tradeoff:** `main` now contains GST-credit schema; rollback `ea33b66` restores pre-feature DB if needed. `docs/` is gitignored (local handover only) — `TODO.md` is the merge-visible source of truth.

**Evidence:** `git merge-base b6c7f5e main`, `TODO.md:212-220` all `[x]`, `check-types` 6/6, `vitest` 16/16. Reasoned with Muse Spark 1.2.

## 2026-08-25 - occasional-discounts - Decision: phase the feature as draft discount first (superseded)

**Why:** It provides owner-controlled, one-off discounts while preserving a clean GST invoice and receipt trail. The current utility-payment flow requires payment to match the bill total, so a discount must be part of the bill snapshot before payment.

**Alternatives:** Support refunds, next-cycle credits, and post-issue credit notes in the first release.

**Tradeoff:** Owners cannot yet use the new action to adjust an issued or paid bill; that workflow remains a later, separately auditable financial feature.

**Evidence:** GST research is recorded in [`research/gst-occasional-discounts.md`](./research/gst-occasional-discounts.md). Reasoned with Codex GPT-5.6 Terra.

## 2026-08-26 - beta-audit — Decision: fix audit via `fix/beta-bugfix-audit-2026-08-26` ship-loop, github-centric, R2 excluded + Aadhaar in-scope

**Why:** Audit 2026-08-26 found 6 P0 regressions `lease.ts:255` dead update + `payment.ts:139` unconditional `isPaid` + `credit.helpers.ts:8` missing payments + `credit.ts:128` no reversal row + `tenant-portal.ts:372` race + `email/src/index.ts:385` XSS + GST/soft-delete/scheduled leaks; all block beta gate `TODO.md:19-20`. Owner constraint: github-centric delivery, no manual `wrangler` bucket `cors set`/`deploy`, R2 operational checks are separate infra ticket, but `AADHAAR_UPLOADS_ENABLED=false` code paths must be proven (`tenant-document.ts:89`). Branch isolates 10 slices with explicit rollback `b2ed822` so `main` stays shippable.

**Alternatives:** A) Single mega-commit fixing all C/H — rejected (unreviewable, no bisect, violates ship-loop tier). B) Include R2 CORS `wrangler` push in same branch — rejected (owner asked separate, github-centric). C) Do Aadhaar backend + R2 CORS smoke together — rejected, R2 already has `cors.json:1` correct shape but needs infra-deployed verification outside this code PR.

**Tradeoff:** 10 small PR-able slices = more commits, slower merge, but each slices verify `check-types`/`vitest rently_test`/`build` independently and `TODO.md:19` R2 stays open until infra ticket (beta smoke must still pass `AADHAAR_UPLOAD_DISABLED` negative path).

**Evidence:** `docs/Bug-2026-08-26-beta-audit.md` Found/Repro/Plan table, `docs/Constraints.md` github-centric update, `apps/server/wrangler.json:23` `AADHAAR_UPLOADS_ENABLED=false`, `TODO.md:19-20,127-128`.

## 2026-08-25 - account-linking-security - Decision: skip TOTP 2FA, ship Google linking + sessions polish

**Why:** `TODO.md:253` TOTP placeholder evaluated on `feat/account-linking-security @ 7d8a1b9`; Indian owner segment low tech-savvy, password+Google 1-tap + `requireEmailVerification:true` covers beta. TOTP adds QR/backup-code support burden and low adoption. `packages/auth/src/index.ts:93` already has `google`+`github`+`accountLinking.enabled:true` via `account` table `packages/db/src/schema/auth.ts:77` — no migration needed. Sessions via `session` table (`ipAddress`, `userAgent`) already stored, just needed UI for `/list-sessions` + `/revoke-session`.

**Alternatives:** A) TOTP now (1 table `twoFactor`, QR, backupCodes), B) Passkey `@better-auth/passkey` (phishing-resistant but device/recovery friction + `passkey` table), C) Both. Rejected — complexity > beta value. Instagram as auth rejected (no email, Meta review); keep as profile handle only.

**Tradeoff:** No second factor if password leaks; mitigated by Google's own 2FA + email verification + `setPassword` fallback for OAuth-only users. Revisit 2FA/passkey after 20+ paying owners request it (logged in `TODO.md` Deferred).

**Evidence:** `docs/Feature-2FA-deferred.md`, `docs/Feature-account-linking.md`, `apps/dashboard/src/components/features/settings/security-tab.tsx:38` new Connected Accounts + Set Password + Sessions list, `check-types` 6/6, `build` 5/5. Reasoned with Muse Spark 1.2.
