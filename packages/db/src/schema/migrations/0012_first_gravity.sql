CREATE UNIQUE INDEX "admin_audit_logs_one_beta_expiry_idx" ON "admin_audit_logs" USING btree ("target_id") WHERE "admin_audit_logs"."action" = 'beta_code.expired';
