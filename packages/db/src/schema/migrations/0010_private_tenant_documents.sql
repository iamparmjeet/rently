ALTER TABLE "document_update_requests" RENAME TO "legacy_document_update_requests";
--> statement-breakpoint
ALTER TABLE "tenant_profiles" ADD COLUMN "aadhaar_last_four" text;
--> statement-breakpoint
ALTER TABLE "tenant_profiles" DROP CONSTRAINT IF EXISTS "tenant_profiles_uid_number_unique";
--> statement-breakpoint
UPDATE "tenant_profiles"
SET "aadhaar_last_four" = CASE
	WHEN length(regexp_replace("uid_number", '[^0-9]', '', 'g')) >= 4
	THEN right(regexp_replace("uid_number", '[^0-9]', '', 'g'), 4)
	ELSE NULL
END,
"uid_number" = NULL
WHERE "uid_number" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "tenant_profiles"
	ADD CONSTRAINT "tenant_profiles_aadhaar_last_four_check"
	CHECK ("aadhaar_last_four" IS NULL OR "aadhaar_last_four" ~ '^[0-9]{4}$');
--> statement-breakpoint
CREATE TABLE "tenant_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_profile_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"version" integer NOT NULL,
	"supersedes_document_id" uuid,
	"update_request_id" uuid,
	"status" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"etag" text,
	"identifier_hint" text,
	"masked_aadhaar_confirmed" boolean,
	"submission_source" text NOT NULL,
	"submitted_by_id" uuid NOT NULL,
	"submitted_at" timestamp,
	"upload_expires_at" timestamp NOT NULL,
	"consent_source" text,
	"consent_version" text,
	"consented_by_id" uuid,
	"consented_at" timestamp,
	"consent_expires_at" timestamp,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"review_note" text,
	"purge_after" timestamp,
	"purged_at" timestamp,
	"purge_attempts" integer DEFAULT 0 NOT NULL,
	"last_purge_error_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_documents_version_check" CHECK ("version" > 0),
	CONSTRAINT "tenant_documents_size_bytes_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760),
	CONSTRAINT "tenant_documents_content_type_check" CHECK ("content_type" IN ('application/pdf', 'image/jpeg', 'image/png')),
	CONSTRAINT "tenant_documents_document_type_check" CHECK ("document_type" IN ('aadhaar', 'pan', 'passport_photo', 'police_verification', 'bank_passbook', 'voter_id')),
	CONSTRAINT "tenant_documents_status_check" CHECK ("status" IN ('upload_pending', 'awaiting_tenant_consent', 'pending_review', 'owner_reviewed', 'rejected', 'superseded', 'expired')),
	CONSTRAINT "tenant_documents_submission_source_check" CHECK ("submission_source" IN ('tenant', 'owner')),
	CONSTRAINT "tenant_documents_consent_source_check" CHECK ("consent_source" IS NULL OR "consent_source" IN ('tenant_direct_upload', 'tenant_confirmed_owner_upload', 'tenant_update_request'))
);
--> statement-breakpoint
CREATE TABLE "document_update_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_profile_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"owner_note" text,
	"approved_expires_at" timestamp,
	"replacement_document_id" uuid,
	"submitted_at" timestamp,
	"completed_at" timestamp,
	"rejected_at" timestamp,
	"expired_at" timestamp,
	"consent_version" text NOT NULL,
	"consented_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_update_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'submitted', 'completed', 'rejected', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_tenant_profile_id_fk" FOREIGN KEY ("tenant_profile_id") REFERENCES "public"."tenant_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_supersedes_document_id_fk" FOREIGN KEY ("supersedes_document_id") REFERENCES "public"."tenant_documents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_update_request_id_fk" FOREIGN KEY ("update_request_id") REFERENCES "public"."document_update_requests"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_submitted_by_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_consented_by_id_fk" FOREIGN KEY ("consented_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_reviewed_by_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_update_requests" ADD CONSTRAINT "document_update_requests_tenant_profile_id_fk" FOREIGN KEY ("tenant_profile_id") REFERENCES "public"."tenant_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_update_requests" ADD CONSTRAINT "document_update_requests_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_update_requests" ADD CONSTRAINT "document_update_requests_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."tenant_documents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_update_requests" ADD CONSTRAINT "document_update_requests_requested_by_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_update_requests" ADD CONSTRAINT "document_update_requests_reviewed_by_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_update_requests" ADD CONSTRAINT "document_update_requests_replacement_document_id_fk" FOREIGN KEY ("replacement_document_id") REFERENCES "public"."tenant_documents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_documents_tenant_type_version_key" ON "tenant_documents" USING btree ("tenant_profile_id", "document_type", "version");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_documents_one_reviewed_per_type_key" ON "tenant_documents" USING btree ("tenant_profile_id", "document_type") WHERE "status" = 'owner_reviewed';
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_documents_one_replacement_per_request_key" ON "tenant_documents" USING btree ("update_request_id") WHERE "update_request_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "tenant_documents_purge_idx" ON "tenant_documents" USING btree ("purge_after") WHERE "purge_after" IS NOT NULL AND "purged_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "tenant_documents_owner_profile_type_idx" ON "tenant_documents" USING btree ("owner_id", "tenant_profile_id", "document_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_documents_storage_key_key" ON "tenant_documents" USING btree ("storage_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_update_requests_one_active_key" ON "document_update_requests" USING btree ("source_document_id") WHERE "status" IN ('pending', 'approved', 'submitted');
