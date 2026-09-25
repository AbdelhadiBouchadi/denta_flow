CREATE TYPE "public"."blood_type" AS ENUM('a_pos', 'a_neg', 'b_pos', 'b_neg', 'ab_pos', 'ab_neg', 'o_pos', 'o_neg');--> statement-breakpoint
CREATE TYPE "public"."smoking_status" AS ENUM('none', 'occasional', 'regular');--> statement-breakpoint
CREATE TABLE "medical_histories" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"on_anticoagulants" boolean DEFAULT false NOT NULL,
	"on_bisphosphonates" boolean DEFAULT false NOT NULL,
	"needs_antibiotic_prophylaxis" boolean DEFAULT false NOT NULL,
	"is_pregnant" boolean,
	"pregnancy_weeks" integer,
	"is_breastfeeding" boolean,
	"current_medications" text,
	"surgical_history" text,
	"anesthesia_reactions" text,
	"smoking" "smoking_status" DEFAULT 'none' NOT NULL,
	"bruxism" boolean DEFAULT false NOT NULL,
	"blood_type" "blood_type",
	"primary_doctor_name" text,
	"primary_doctor_phone" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relation" text,
	"updated_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "medical_histories_patient_id_unique" UNIQUE("patient_id"),
	CONSTRAINT "medical_histories_pregnancy_weeks_range" CHECK (pregnancy_weeks IS NULL OR pregnancy_weeks BETWEEN 1 AND 42)
);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "profession" text;--> statement-breakpoint
ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_updated_by_staff_id_user_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;