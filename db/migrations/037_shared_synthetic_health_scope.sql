-- Patient-selected, version-bound nonclinical record IDs only. No record payload.
-- NULL preserves the no-health-access meaning of existing image-only consents.
ALTER TABLE consents ADD COLUMN IF NOT EXISTS health_record_scope jsonb;
-- No runtime privileges or retrospective consent updates are granted here.
