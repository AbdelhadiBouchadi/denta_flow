ALTER TABLE "documents" ALTER COLUMN "storage_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "number" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "snapshot" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_by_staff_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_staff_id_user_id_fk" FOREIGN KEY ("deleted_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_type_number_idx" ON "documents" USING btree ("type","number");