ALTER TABLE "treatments" ADD COLUMN "nomenclature_code" text;--> statement-breakpoint
-- Backfill the snapshot from the linked service. An acte whose service was
-- unlinked (FK set null) keeps NULL: there is nothing to snapshot.
UPDATE "treatments" AS t
SET "nomenclature_code" = s."nomenclature_code"
FROM "services" AS s
WHERE t."service_id" = s."id"
  AND t."nomenclature_code" IS NULL
  AND s."nomenclature_code" IS NOT NULL;
