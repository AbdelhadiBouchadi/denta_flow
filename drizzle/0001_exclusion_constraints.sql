CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

ALTER TABLE appointments
  ADD CONSTRAINT appointments_practitioner_no_overlap
  EXCLUDE USING gist (
    practitioner_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status NOT IN ('canceled', 'no_show') AND practitioner_id IS NOT NULL);
