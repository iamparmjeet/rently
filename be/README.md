
// Pending tasks
Logic	Description	Solution
- [ ] Aggregate rent view	combine utilities + base rent per tenant	create service: RentSummaryService.getTenantBill(leaseId)
- [ ] Admin management	required for user and plan control	add /admin routes
- [ ] Trial expiry automation	mark expired subscriptions	add daily cron (bun or system cron)
- [ ] Payment aggregation	show total paid vs due per lease	SQL SUM(amount) group queries
- [ ] Invite email sending	actual delivery layer missing	add Resend/email.js or nodemailer
- [ ] Tenant utilities union	separate and combine utility costs	implement aggregated query
- [ ] Audit	updatedBy, track who changes lease/payments	add updated_by FK


// Enhancements

// Category	Suggested Enhancement
- [ ] Auth	Link invite → user signup flow auto-role assignment
- [ ] Accounting	Utility + Payment summaries per tenant
- [ ] DB	Add foreign key cascades; non-null constraints
- [ ] Notifications	Email invite acceptance, subscription expiry alerts
- [ ] Type-safety	Add safeHandler() for consistent responses
- [ ] Roles	Separate admin/tenant routes
- [ ] Subscriptions	Add renewal handling job/cron
- [ ] RPC	Implement Hono RPC client as typed bridge to FE
- [ ] Infra	Add CORS + rate-limiting middleware