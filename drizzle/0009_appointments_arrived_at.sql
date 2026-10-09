ALTER TABLE "appointments" ADD COLUMN "arrived_at" timestamp with time zone;--> statement-breakpoint
-- Backfill before the CHECK: every row already in the waiting room gets its last update as its arrival.
-- `updated_at` is a zoneless timestamp holding UTC wall time (drizzle writes it so),
-- hence AT TIME ZONE 'UTC' rather than the session zone's implicit cast.
UPDATE "appointments" SET "arrived_at" = "updated_at" AT TIME ZONE 'UTC' WHERE "status" = 'arrived';--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_arrived_at_matches_status" CHECK (("appointments"."status" <> 'arrived' OR "appointments"."arrived_at" IS NOT NULL) AND ("appointments"."status" NOT IN ('planned', 'confirmed') OR "appointments"."arrived_at" IS NULL));
