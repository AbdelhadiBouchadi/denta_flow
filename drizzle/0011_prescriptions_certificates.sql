CREATE TABLE "certificate_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"form" text NOT NULL,
	"strength" text,
	"default_posology" text,
	"default_duration" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_pack_items" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"medication_id" text NOT NULL,
	"posology" text NOT NULL,
	"duration" text,
	"remark" text,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_packs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prescription_pack_items" ADD CONSTRAINT "prescription_pack_items_pack_id_prescription_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."prescription_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_pack_items" ADD CONSTRAINT "prescription_pack_items_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "medications_name_key_idx" ON "medications" USING btree ("name_key");--> statement-breakpoint
CREATE INDEX "medications_active_idx" ON "medications" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_pack_items_position_idx" ON "prescription_pack_items" USING btree ("pack_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_packs_name_idx" ON "prescription_packs" USING btree (lower("name"));