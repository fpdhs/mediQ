-- Explicit operator migration; no automatic registration or ownership changes.
-- Legacy subject remains the ownership FK. Entra's mapped actor is distinct.
ALTER TABLE capstone_patient_self_view_grants
  ADD COLUMN authenticated_subject varchar(128)
    CHECK (authenticated_subject IS NULL OR authenticated_subject ~ '^synthetic-[a-z0-9-]{1,64}$');
-- Existing table-level SELECT/INSERT grants suffice; no new role or write grants.
-- Legacy rows remain NULL. Rollback application first; retain this additive column.
