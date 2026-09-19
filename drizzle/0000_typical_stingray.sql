CREATE TYPE "public"."appointment_status" AS ENUM('planned', 'confirmed', 'arrived', 'completed', 'canceled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."dentition" AS ENUM('adult', 'child');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('facture', 'devis', 'feuille_de_soins', 'ordonnance', 'certificat');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('supplies', 'lab', 'rent', 'utilities', 'salaries', 'equipment', 'maintenance', 'taxes', 'other');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'check', 'card', 'transfer', 'insurance');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('consultation', 'restorative', 'endodontics', 'prosthetics', 'surgery', 'orthodontics', 'periodontics', 'implantology', 'cosmetic', 'other');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('admin', 'dentist', 'assistant', 'secretary');--> statement-breakpoint
CREATE TYPE "public"."treatment_status" AS ENUM('planned', 'in_progress', 'completed', 'canceled');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_types" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT '#0D9488' NOT NULL,
	"default_duration_minutes" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"practitioner_id" text,
	"type_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'planned' NOT NULL,
	"reason" text,
	"notes" text,
	"created_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinic_settings" (
	"id" text PRIMARY KEY DEFAULT 'clinic' NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"phone" text,
	"email" text,
	"ice" text,
	"patente" text,
	"fiscal_id" text,
	"cnss_number" text,
	"inpe" text,
	"logo_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"type" "document_type" NOT NULL,
	"file_name" text NOT NULL,
	"storage_url" text NOT NULL,
	"generated_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"category" "expense_category" DEFAULT 'other' NOT NULL,
	"amount_cents" integer NOT NULL,
	"spent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier" text,
	"notes" text,
	"created_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odontogram_charts" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"dentition" "dentition" DEFAULT 'adult' NOT NULL,
	"initial" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_tags" (
	"patient_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "patient_tags_patient_id_tag_id_pk" PRIMARY KEY("patient_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"short_code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text NOT NULL,
	"secondary_phone" text,
	"email" text,
	"birth_date" date,
	"gender" "gender",
	"address" text,
	"city" text,
	"cin" text,
	"insurer_id" text,
	"insurance_number" text,
	"allergies" text,
	"medical_notes" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patients_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"treatment_id" text,
	"insurer_id" text,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" text,
	"notes" text,
	"created_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioner_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"practitioner_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"practitioner_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"category" "service_category" DEFAULT 'other' NOT NULL,
	"default_price_cents" integer DEFAULT 0 NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT '#0D9488' NOT NULL,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"due_date" date,
	"is_important" boolean DEFAULT false NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"created_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatments" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"appointment_id" text,
	"service_id" text,
	"practitioner_id" text,
	"label" text NOT NULL,
	"teeth" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_amount_cents" integer DEFAULT 0 NOT NULL,
	"status" "treatment_status" DEFAULT 'planned' NOT NULL,
	"performed_at" timestamp with time zone,
	"notes" text,
	"created_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"role" "staff_role" DEFAULT 'assistant' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"title" text,
	"inpe" text,
	"color" text DEFAULT '#0D9488' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_staff_id_user_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_practitioner_id_user_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_type_id_appointment_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."appointment_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_staff_id_user_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_generated_by_staff_id_user_id_fk" FOREIGN KEY ("generated_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_staff_id_user_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_charts" ADD CONSTRAINT "odontogram_charts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_charts" ADD CONSTRAINT "odontogram_charts_updated_by_staff_id_user_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_tags" ADD CONSTRAINT "patient_tags_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_tags" ADD CONSTRAINT "patient_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_staff_id_user_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_treatment_id_treatments_id_fk" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_staff_id_user_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_schedules" ADD CONSTRAINT "practitioner_schedules_practitioner_id_user_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_practitioner_id_user_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_staff_id_user_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_practitioner_id_user_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_created_by_staff_id_user_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "appointments_starts_at_idx" ON "appointments" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "appointments_practitioner_starts_at_idx" ON "appointments" USING btree ("practitioner_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "documents_patient_idx" ON "documents" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "expenses_spent_at_idx" ON "expenses" USING btree ("spent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "odontogram_patient_dentition_idx" ON "odontogram_charts" USING btree ("patient_id","dentition");--> statement-breakpoint
CREATE INDEX "patients_last_name_idx" ON "patients" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "patients_phone_idx" ON "patients" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "patients_archived_idx" ON "patients" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "payments_patient_idx" ON "payments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "payments_treatment_idx" ON "payments" USING btree ("treatment_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "practitioner_schedules_idx" ON "practitioner_schedules" USING btree ("practitioner_id","weekday");--> statement-breakpoint
CREATE INDEX "schedule_exceptions_starts_at_idx" ON "schedule_exceptions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "services_category_idx" ON "services" USING btree ("category");--> statement-breakpoint
CREATE INDEX "treatments_patient_idx" ON "treatments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "treatments_performed_at_idx" ON "treatments" USING btree ("performed_at");