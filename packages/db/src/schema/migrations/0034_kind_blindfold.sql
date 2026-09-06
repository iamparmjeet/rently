CREATE TABLE "beta_code_redemptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "beta_code_redemptions" ADD CONSTRAINT "beta_code_redemptions_code_id_beta_access_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."beta_access_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_code_redemptions" ADD CONSTRAINT "beta_code_redemptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "beta_code_redemptions_code_user_unique" ON "beta_code_redemptions" USING btree ("code_id","user_id");