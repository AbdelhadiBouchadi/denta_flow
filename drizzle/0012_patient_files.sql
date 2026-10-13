CREATE TYPE "public"."patient_file_kind" AS ENUM('panoramic', 'periapical', 'cephalometric', 'photo', 'other');--> statement-breakpoint
CREATE TABLE "patient_files" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"kind" "patient_file_kind" NOT NULL,
	"blob_pathname" text NOT NULL,
	"thumb_pathname" text,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"original_name" text NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"notes" text,
	"uploaded_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_staff_id" text,
	CONSTRAINT "patient_files_size_positive" CHECK ("patient_files"."size_bytes" > 0),
	CONSTRAINT "patient_files_dimensions_range" CHECK ("patient_files"."width" BETWEEN 64 AND 12000 AND "patient_files"."height" BETWEEN 64 AND 12000)
);
--> statement-breakpoint
ALTER TABLE "patient_files" ADD CONSTRAINT "patient_files_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_files" ADD CONSTRAINT "patient_files_uploaded_by_staff_id_user_id_fk" FOREIGN KEY ("uploaded_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_files" ADD CONSTRAINT "patient_files_deleted_by_staff_id_user_id_fk" FOREIGN KEY ("deleted_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "patient_files_blob_pathname_idx" ON "patient_files" USING btree ("blob_pathname");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_files_thumb_pathname_idx" ON "patient_files" USING btree ("thumb_pathname");--> statement-breakpoint
CREATE INDEX "patient_files_patient_taken_at_idx" ON "patient_files" USING btree ("patient_id","deleted_at","taken_at" DESC NULLS LAST);