-- Durable transfer metadata only. DICOM bytes, access tokens, DPoP proofs,
-- encryption keys, and PACS credentials must never be stored here.
BEGIN;

CREATE TABLE capstone_pacs_transfer_jobs (
  job_id uuid PRIMARY KEY,
  actor_id varchar(128) NOT NULL,
  source_hospital_id varchar(64) NOT NULL,
  target_hospital_id varchar(64) NOT NULL,
  consent_id varchar(128) NOT NULL,
  audit_session_id varchar(128) NOT NULL,
  purpose varchar(32) NOT NULL CHECK (purpose ~ '^[A-Z][A-Z0-9_]{0,31}$'),
  permission varchar(32) NOT NULL CHECK (permission = 'DOWNLOAD_ALLOWED'),
  idempotency_key_hash char(64) NOT NULL CHECK (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  manifest_sha256 char(64) NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  state varchar(16) NOT NULL CHECK (state IN ('CREATED','IN_PROGRESS','PARTIAL','COMPLETED','FAILED','EXPIRED','REVOKED')),
  total_items integer NOT NULL CHECK (total_items BETWEEN 1 AND 10000),
  succeeded_items integer NOT NULL DEFAULT 0 CHECK (succeeded_items >= 0),
  failed_items integer NOT NULL DEFAULT 0 CHECK (failed_items >= 0),
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (actor_id, target_hospital_id, idempotency_key_hash),
  CHECK (succeeded_items + failed_items <= total_items),
  CHECK (valid_until > created_at)
);

CREATE INDEX capstone_pacs_transfer_jobs_actor_idx
  ON capstone_pacs_transfer_jobs (actor_id, created_at DESC);
CREATE INDEX capstone_pacs_transfer_jobs_expiry_idx
  ON capstone_pacs_transfer_jobs (valid_until)
  WHERE state IN ('CREATED','IN_PROGRESS','PARTIAL');
CREATE INDEX capstone_pacs_transfer_jobs_active_actor_idx
  ON capstone_pacs_transfer_jobs (actor_id, target_hospital_id, updated_at DESC)
  WHERE state IN ('CREATED','IN_PROGRESS','PARTIAL');

CREATE TABLE capstone_pacs_transfer_items (
  item_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES capstone_pacs_transfer_jobs(job_id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 1 AND 10000),
  study_instance_uid varchar(64) NOT NULL CHECK (study_instance_uid ~ '^[0-9]+(\.[0-9]+)+$'),
  series_instance_uid varchar(64) NOT NULL CHECK (series_instance_uid ~ '^[0-9]+(\.[0-9]+)+$'),
  sop_instance_uid varchar(64) NOT NULL CHECK (sop_instance_uid ~ '^[0-9]+(\.[0-9]+)+$'),
  source_sha256 char(64) CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[a-f0-9]{64}$'),
  state varchar(16) NOT NULL CHECK (state IN ('PENDING','IN_PROGRESS','RETRYABLE','SUCCEEDED','FAILED','EXPIRED','REVOKED')),
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  max_attempts smallint NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5),
  destination_sop_instance_uid varchar(64),
  destination_sha256 char(64),
  reason_code varchar(64) CHECK (reason_code IS NULL OR reason_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  lease_id uuid,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (job_id, ordinal),
  UNIQUE (job_id, sop_instance_uid),
  CHECK (attempt_count <= max_attempts),
  CHECK (destination_sop_instance_uid IS NULL OR destination_sop_instance_uid ~ '^[0-9]+(\.[0-9]+)+$'),
  CHECK (destination_sha256 IS NULL OR destination_sha256 ~ '^[a-f0-9]{64}$'),
  CHECK ((state = 'IN_PROGRESS' AND lease_id IS NOT NULL AND lease_expires_at IS NOT NULL)
      OR (state <> 'IN_PROGRESS' AND lease_id IS NULL AND lease_expires_at IS NULL)),
  CHECK (state <> 'SUCCEEDED' OR (destination_sop_instance_uid = sop_instance_uid AND destination_sha256 = source_sha256))
);

CREATE INDEX capstone_pacs_transfer_items_claim_idx
  ON capstone_pacs_transfer_items (job_id, ordinal)
  WHERE state IN ('PENDING','RETRYABLE','IN_PROGRESS');
REVOKE ALL ON capstone_pacs_transfer_jobs, capstone_pacs_transfer_items FROM PUBLIC;
-- Apply least-privilege SELECT/INSERT/UPDATE grants only through the reviewed
-- deployment operator. Do not grant access to the general web application role.
COMMIT;
