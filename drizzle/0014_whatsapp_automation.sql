CREATE TYPE "public"."whatsapp_channel" AS ENUM('whatsapp_twilio', 'manual_link');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_consent" AS ENUM('granted', 'declined', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_event" AS ENUM('reminder', 'confirmation', 'reschedule', 'cancellation');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_status" AS ENUM('scheduled', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped', 'canceled', 'needs_attention', 'manual_opened');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_skip_reason" AS ENUM('no_consent', 'invalid_phone', 'landline', 'too_late', 'appointment_status', 'clinic_phone_missing', 'superseded');--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"rule_id" text,
	"event" "whatsapp_event" NOT NULL,
	"occurrence_key" text NOT NULL,
	"for_starts_at" timestamp with time zone NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "whatsapp_message_status" DEFAULT 'scheduled' NOT NULL,
	"skip_reason" "whatsapp_skip_reason",
	"channel" "whatsapp_channel",
	"provider_message_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"opened_at" timestamp with time zone,
	"opened_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_provider_message_id_unique" UNIQUE("provider_message_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"event" "whatsapp_event" NOT NULL,
	"offset_minutes" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_rules_offset_range" CHECK (("whatsapp_rules"."event" = 'reminder' AND "whatsapp_rules"."offset_minutes" BETWEEN 60 AND 10080)
      OR ("whatsapp_rules"."event" <> 'reminder' AND "whatsapp_rules"."offset_minutes" BETWEEN 0 AND 1440))
);
--> statement-breakpoint
CREATE TABLE "whatsapp_settings" (
	"id" text PRIMARY KEY DEFAULT 'whatsapp' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"window_start" time DEFAULT '09:00:00' NOT NULL,
	"window_end" time DEFAULT '19:00:00' NOT NULL,
	"min_lead_minutes" integer DEFAULT 120 NOT NULL,
	"last_cron_at" timestamp with time zone,
	"last_cron_claimed" integer DEFAULT 0 NOT NULL,
	"last_cron_sent" integer DEFAULT 0 NOT NULL,
	"last_cron_failed" integer DEFAULT 0 NOT NULL,
	"last_cron_needs_attention" integer DEFAULT 0 NOT NULL,
	"updated_by_staff_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_settings_window_order" CHECK ("whatsapp_settings"."window_start" < "whatsapp_settings"."window_end"),
	CONSTRAINT "whatsapp_settings_min_lead_range" CHECK ("whatsapp_settings"."min_lead_minutes" BETWEEN 0 AND 1440)
);
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "whatsapp_event" NOT NULL,
	"content_sid" text,
	"language" text DEFAULT 'fr' NOT NULL,
	"manual_text" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_templates_name_unique" UNIQUE("name"),
	CONSTRAINT "whatsapp_templates_content_sid_format" CHECK ("whatsapp_templates"."content_sid" IS NULL OR "whatsapp_templates"."content_sid" ~ '^HX[0-9a-fA-F]{32}$')
);
--> statement-breakpoint
-- Hand-moved: the composite foreign key below needs this unique index to exist first.
CREATE UNIQUE INDEX "whatsapp_templates_id_kind_idx" ON "whatsapp_templates" USING btree ("id","kind");--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "whatsapp_consent" "whatsapp_consent" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_rule_id_whatsapp_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."whatsapp_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_opened_by_staff_id_user_id_fk" FOREIGN KEY ("opened_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_rules" ADD CONSTRAINT "whatsapp_rules_template_kind_fk" FOREIGN KEY ("template_id","event") REFERENCES "public"."whatsapp_templates"("id","kind") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_updated_by_staff_id_user_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_occurrence_idx" ON "whatsapp_messages" USING btree ("appointment_id","rule_id","occurrence_key");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_status_scheduled_for_idx" ON "whatsapp_messages" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_appointment_idx" ON "whatsapp_messages" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_sent_at_idx" ON "whatsapp_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_rules_event_offset_idx" ON "whatsapp_rules" USING btree ("event","offset_minutes");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_rules_single_event_idx" ON "whatsapp_rules" USING btree ("event") WHERE "whatsapp_rules"."event" <> 'reminder';--> statement-breakpoint
-- Hand-written: the single settings row (manual mode until an admin flips the switch).
INSERT INTO "whatsapp_settings" ("id") VALUES ('whatsapp') ON CONFLICT ("id") DO NOTHING;
