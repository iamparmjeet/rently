# KeyHQ Beta Production Smoke Test

Use this checklist after a beta deployment and record the results in the pull
request description or in attached screenshots. Do not commit passwords,
invitation tokens, password-reset links, personal email addresses, or other
secrets.

## Production URLs

- Web: <https://keyhq.parmjeetmishra.com>
- Dashboard: <https://dashboard-keyhq.parmjeetmishra.com>
- Tenant portal: <https://tenant-keyhq.parmjeetmishra.com>

## Preconditions

- [ ] Use a disposable owner email address with inbox access.
- [ ] Use a disposable tenant email address with inbox access.
- [ ] Create clearly labelled QA data only, such as `QA Smoke Property`,
  `QA-001`, and `QA August Rent`.
- [ ] Do not upload real identity documents or use real tenant personal data.
- [ ] No real UPI transfer is required. Record a clearly labelled manual QA
  payment instead.
- [ ] Record only disposable account aliases, the test date, environment, and
  pass/fail results in the evidence.

## Smoke flow

| # | Check | Result | Evidence |
|---:|---|---|---|
| 1 | Register a new owner account from the Web app. | [ ] Pass [ ] Fail | |
| 2 | Receive the verification email and complete the verification redirect. | [ ] Pass [ ] Fail | |
| 3 | Log in as the verified owner. | [ ] Pass [ ] Fail | |
| 4 | Confirm the subscription plan/status badge in the expanded desktop sidebar. | [ ] Pass [ ] Fail | |
| 5 | Confirm the badge behaves correctly in collapsed and mobile sidebar modes. | [ ] Pass [ ] Fail | |
| 6 | Confirm the sidebar badge matches the `/subscriptions` page. | [ ] Pass [ ] Fail | |
| 7 | Create the labelled QA property and unit. | [ ] Pass [ ] Fail | |
| 8 | Create an owner-prepared tenant invite. | [ ] Pass [ ] Fail | |
| 9 | Confirm the tenant invite email is delivered. | [ ] Pass [ ] Fail | |
| 10 | Complete tenant password setup from the invite. | [ ] Pass [ ] Fail | |
| 11 | Log in to the tenant portal and confirm lease and bill visibility. | [ ] Pass [ ] Fail | |
| 12 | Record a clearly labelled manual QA rent payment as the owner. | [ ] Pass [ ] Fail | |
| 13 | Open the owner receipt route and verify the print flow. | [ ] Pass [ ] Fail | |
| 14 | Open the tenant payment history and tenant receipt route. | [ ] Pass [ ] Fail | |
| 15 | Request an owner password reset. | [ ] Pass [ ] Fail | |
| 16 | Complete the password reset from the email and log in with the new password. | [ ] Pass [ ] Fail | |
| 17 | Verify cross-app routing between Web, Dashboard, and Tenant Portal. | [ ] Pass [ ] Fail | |
| 18 | Verify **Aadhaar blocked** — tenant masked Aadhaar upload attempt must return `AADHAAR_UPLOAD_DISABLED` (`env AADHAAR_UPLOADS_ENABLED=false` `wrangler.json:23` + `tenant-document.ts:89 assertEnabled`). | [ ] Pass [ ] Fail | |
| 19 | Upload non-Aadhaar document (PAN `image/png` or `application/pdf`) via presigned URL and verify private viewer/preview (tab-only cache, no public URL) | [ ] Pass [ ] Fail | |

## Evidence record

Record the following in the pull request description or attached screenshots:

- Test date and environment.
- Disposable owner and tenant account aliases only.
- Pass/fail result for every step.
- Screenshots of the sidebar badge, subscription page, tenant portal, and
  receipt.
- Reproduction details for every failed step.

Before sharing evidence, remove passwords, tokens, reset links, personal email
addresses, and any other secrets.
