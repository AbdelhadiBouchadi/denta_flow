ALTER TABLE "tasks" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
-- Backfill before the CHECK: every already-done task gets its last update as its completion.
-- `updated_at` is a zoneless timestamp holding UTC wall time (drizzle writes it so),
-- hence AT TIME ZONE 'UTC' rather than the session zone's implicit cast.
UPDATE "tasks" SET "completed_at" = "updated_at" AT TIME ZONE 'UTC' WHERE "is_done" = true;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_at_matches_is_done" CHECK ("tasks"."is_done" = ("tasks"."completed_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_content_length" CHECK (char_length("tasks"."content") BETWEEN 1 AND 280);
