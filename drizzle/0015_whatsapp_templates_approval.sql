CREATE TYPE "public"."whatsapp_template_approval" AS ENUM('draft', 'pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."whatsapp_skip_reason" ADD VALUE 'template_unapproved';--> statement-breakpoint
-- Hand-edited: `body` and `variables` are added nullable, filled from the old
-- columns below, then made NOT NULL (the generator adds them NOT NULL at once,
-- which fails on existing rows).
ALTER TABLE "whatsapp_templates" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "variables" jsonb;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "approval_status" "whatsapp_template_approval" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "approval_name" text;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "approval_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "active_content_sid" text;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "active_variables" jsonb;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "pending_content_sid" text;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD COLUMN "pending_variables" jsonb;--> statement-breakpoint
-- Hand-written data step. `manual_text` ({prenom} {date} {heure} {cabinet}
-- {telephone}) becomes the canonical body: each token is numbered {{1}},
-- {{2}}… in order of first appearance — WhatsApp requires sequential
-- placeholders — and `variables` records which value each number carries.
DO $$
DECLARE
  r record;
  txt text;
  vars jsonb;
  n int;
  i int;
  p int;
  best_p int;
  best_i int;
  tokens text[] := ARRAY['{prenom}', '{date}', '{heure}', '{cabinet}', '{telephone}'];
  keys text[] := ARRAY['firstName', 'date', 'time', 'clinicName', 'clinicPhone'];
BEGIN
  FOR r IN SELECT id, manual_text FROM whatsapp_templates LOOP
    txt := r.manual_text;
    vars := '[]'::jsonb;
    n := 0;
    LOOP
      best_p := 0;
      best_i := 0;
      FOR i IN 1..5 LOOP
        p := strpos(txt, tokens[i]);
        IF p > 0 AND (best_p = 0 OR p < best_p) THEN
          best_p := p;
          best_i := i;
        END IF;
      END LOOP;
      EXIT WHEN best_i = 0;
      n := n + 1;
      txt := replace(txt, tokens[best_i], '{{' || n || '}}');
      vars := vars || to_jsonb(keys[best_i]);
    END LOOP;
    UPDATE whatsapp_templates SET body = txt, variables = vars WHERE id = r.id;
  END LOOP;
END $$;--> statement-breakpoint
-- A SID entered by hand in branch 33 was approved with 33's fixed body: the
-- five variables in their fixed order. It stays the ACTIVE resource, so
-- sending never stops. The status stays `draft`: the text the app now shows
-- is the old manual text, which nothing proves is the approved one.
UPDATE "whatsapp_templates"
SET "active_content_sid" = "content_sid",
    "active_variables" = '["firstName","date","time","clinicName","clinicPhone"]'::jsonb
WHERE "content_sid" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ALTER COLUMN "body" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ALTER COLUMN "variables" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_templates_approval_idx" ON "whatsapp_templates" USING btree ("approval_status","approval_checked_at");--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_approval_name_unique" UNIQUE("approval_name");--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_active_sid_format" CHECK ("whatsapp_templates"."active_content_sid" IS NULL OR "whatsapp_templates"."active_content_sid" ~ '^HX[0-9a-fA-F]{32}$');--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_pending_sid_format" CHECK ("whatsapp_templates"."pending_content_sid" IS NULL OR "whatsapp_templates"."pending_content_sid" ~ '^HX[0-9a-fA-F]{32}$');--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_active_pair" CHECK (("whatsapp_templates"."active_content_sid" IS NULL) = ("whatsapp_templates"."active_variables" IS NULL));--> statement-breakpoint
-- Folded in from a second generator pass (the drops), so drizzle-kit never
-- had to ask whether a column was renamed.
ALTER TABLE "whatsapp_templates" DROP CONSTRAINT "whatsapp_templates_content_sid_format";--> statement-breakpoint
ALTER TABLE "whatsapp_templates" DROP COLUMN "content_sid";--> statement-breakpoint
ALTER TABLE "whatsapp_templates" DROP COLUMN "manual_text";
