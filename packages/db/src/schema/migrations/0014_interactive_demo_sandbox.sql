ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "account_mode" text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "workspace_mode" text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS "sample_workspace_used_at" timestamp,
  ADD COLUMN IF NOT EXISTS "sample_owner_id" uuid REFERENCES "user"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "user_account_mode_idx" ON "user" ("account_mode");
CREATE INDEX IF NOT EXISTS "user_workspace_mode_idx" ON "user" ("workspace_mode");
CREATE INDEX IF NOT EXISTS "user_sample_owner_id_idx" ON "user" ("sample_owner_id");
