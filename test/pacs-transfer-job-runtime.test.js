import test from "node:test";
import assert from "node:assert/strict";
import { createPacsTransferJobRuntime } from "../src/pacs-transfer-job-runtime.js";

class RuntimePool {
  static role = { rolsuper: false, rolbypassrls: false, can_create_schema: false };
  static schema = { jobs: true, items: true };
  static privileges = {};
  static instances = [];
  constructor(config) { this.config = config; this.ended = false; RuntimePool.instances.push(this); }
  on() {}
  async connect() { return {}; }
  async query(sql) {
    if (sql.includes("FROM pg_roles")) return { rows: [RuntimePool.role] };
    if (sql.includes("to_regclass")) return { rows: [RuntimePool.schema] };
    if (sql.includes("has_table_privilege")) {
      const aliases = [...sql.matchAll(/AS (capstone_pacs_transfer_(?:jobs|items)_[a-z]+)/gu)].map(match => match[1]);
      return { rows: [Object.fromEntries(aliases.map(alias => [alias,
        RuntimePool.privileges[alias] ?? /_(?:select|insert|update)$/u.test(alias)]))] };
    }
    throw new Error("UNEXPECTED_RUNTIME_QUERY");
  }
  async end() { this.ended = true; }
}

const enabledEnv = { HIPASS_CAPSTONE_PACS_TRANSFER_JOBS: "1", HIPASS_CONTROL_PLANE_ONLY: "1",
  HIPASS_STORE: "postgres", HIPASS_PACS_TRANSFER_DATABASE_URL: "postgres://synthetic" };
const service = { evaluateDicomAccessRequest() {} };
const readJson = async () => ({});
function reset() { RuntimePool.role = { rolsuper: false, rolbypassrls: false, can_create_schema: false };
  RuntimePool.schema = { jobs: true, items: true }; RuntimePool.privileges = {}; RuntimePool.instances = []; }

test("transfer-job runtime is absent unless the explicit feature flag is enabled", async () => {
  reset();
  assert.equal(await createPacsTransferJobRuntime({ env: {}, Pool: RuntimePool }), null);
  assert.equal(RuntimePool.instances.length, 0);
});

test("transfer-job runtime requires Control Plane PostgreSQL and a separate DB URL", async () => {
  for (const env of [
    { ...enabledEnv, HIPASS_CONTROL_PLANE_ONLY: "0" },
    { ...enabledEnv, HIPASS_STORE: "json" },
    { ...enabledEnv, HIPASS_PACS_TRANSFER_DATABASE_URL: "" }
  ]) {
    await assert.rejects(createPacsTransferJobRuntime({ env, service, readJson, Pool: RuntimePool }),
      /PACS_TRANSFER_JOB_PROFILE_REQUIRED/u);
  }
  assert.equal(RuntimePool.instances.length, 0);
});

test("transfer-job runtime rejects privileged or schema-creating database roles", async () => {
  for (const role of [
    { rolsuper: true, rolbypassrls: false, can_create_schema: false },
    { rolsuper: false, rolbypassrls: true, can_create_schema: false },
    { rolsuper: false, rolbypassrls: false, can_create_schema: true }
  ]) {
    reset(); RuntimePool.role = role;
    await assert.rejects(createPacsTransferJobRuntime({ env: enabledEnv, service, readJson, Pool: RuntimePool }),
      /PACS_TRANSFER_JOB_ROLE_UNSAFE/u);
    assert.equal(RuntimePool.instances.at(-1).ended, true);
  }
});

test("transfer-job runtime requires the migration and only SELECT/INSERT/UPDATE grants", async () => {
  reset(); RuntimePool.schema = { jobs: true, items: false };
  await assert.rejects(createPacsTransferJobRuntime({ env: enabledEnv, service, readJson, Pool: RuntimePool }),
    /PACS_TRANSFER_JOB_MIGRATION_REQUIRED/u);
  assert.equal(RuntimePool.instances.at(-1).ended, true);

  reset(); RuntimePool.privileges.capstone_pacs_transfer_items_delete = true;
  await assert.rejects(createPacsTransferJobRuntime({ env: enabledEnv, service, readJson, Pool: RuntimePool }),
    /PACS_TRANSFER_JOB_ROLE_PRIVILEGES_INVALID/u);
  assert.equal(RuntimePool.instances.at(-1).ended, true);
});

test("transfer-job runtime starts with the least-privilege role and closes its pool", async () => {
  reset();
  const runtime = await createPacsTransferJobRuntime({ env: enabledEnv, service, readJson, Pool: RuntimePool });
  assert.equal(typeof runtime.route, "function");
  assert.match(RuntimePool.instances[0].config.options, /search_path=public/u);
  await runtime.close();
  assert.equal(RuntimePool.instances[0].ended, true);
});
