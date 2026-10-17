// Bounded destructive cleanup for the exact synthetic fixtures on Highpass A test Orthanc.
// Default is inventory-only. Never accepts arbitrary Study UIDs or a broad /studies delete.
import https from "node:https";
import { readFileSync } from "node:fs";

const orthancOrigin = process.env.ORTHANC_REST_URL ?? "https://orthanc-mtls:8443";
const apply = process.argv.includes("--apply");
const confirm = process.env.HIPASS_CLEAR_CONFIRM === "DELETE_KNOWN_SYNTHETIC_TEST_STUDIES";
const tls = {
  ca: readFileSync("/run/secrets/ca.crt"),
  cert: readFileSync("/run/secrets/gateway-client.crt"),
  key: readFileSync("/run/secrets/gateway-client.key"),
  servername: "hospital-a-orthanc-mtls",
  rejectUnauthorized: true,
};
const expectedStudies = new Set([
  "1.2.410.100.1.20260620.001",
  "1.2.410.100.1.20260518.002",
  "1.2.826.0.1.3680043.10.5432.20260908.1001.1",
  "1.2.826.0.1.3680043.10.5432.20261009.1",
  "1.2.826.0.1.3680043.10.5432.20261009.2",
]);

let deletedStudies = 0;
try {
  if (apply && !confirm) throw new Error("APPLY_CONFIRMATION_REQUIRED");
  const system = await requestJson(orthancOrigin, "/system");
  if (system.Name !== "HiPass Hospital A Orthanc" || system.DicomAet !== "HOSPITAL_A") {
    throw new Error("ORTHANC_IDENTITY_MISMATCH");
  }

  const studies = await inspectStudies();
  const observed = new Set(studies.map((study) => study.studyInstanceUid));
  if (observed.size !== expectedStudies.size || [...expectedStudies].some((uid) => !observed.has(uid))) {
    throw new Error("STUDY_SET_NOT_EXACT_KNOWN_SYNTHETIC_FIXTURES");
  }
  const inventory = summarize(studies);
  if (!apply) {
    console.log(JSON.stringify({ status: "PREFLIGHT_PASS", scope: "HIGHPASS_A_TEST_ORTHANC_ONLY", ...inventory }));
    process.exit(0);
  }

  for (const study of studies) {
    await requestJson(orthancOrigin, `/studies/${encodeURIComponent(study.orthancId)}`, "DELETE");
    deletedStudies += 1;
  }

  const remaining = await readCounts();
  if (remaining.studies !== 0 || remaining.series !== 0 || remaining.instances !== 0) {
    throw new Error("POST_DELETE_ORTHANC_NOT_EMPTY");
  }
  const qido = await verifyMtlsQidoEmpty();
  if (!qido) throw new Error("POST_DELETE_MTLS_QIDO_NOT_EMPTY");
  console.log(JSON.stringify({
    status: "DELETE_PASS",
    scope: "HIGHPASS_A_TEST_ORTHANC_ONLY",
    deletedStudies,
    deletedSeries: inventory.series,
    deletedInstances: inventory.instances,
    remaining,
    mtlsQidoStudies: 0,
    rollback: "NOT_CREATED_BY_REQUEST",
  }));
} catch (error) {
  let remaining = null;
  try { remaining = await readCounts(); } catch { /* preserve the original failure code */ }
  console.error(JSON.stringify({
    status: deletedStudies > 0 ? "PARTIAL_DELETE" : "ABORTED",
    reason: safeReason(error),
    deletedStudies,
    remaining,
  }));
  process.exitCode = 1;
}

async function inspectStudies() {
  const orthancIds = await requestJson(orthancOrigin, "/studies");
  if (!Array.isArray(orthancIds)) throw new Error("ORTHANC_STUDY_LIST_INVALID");
  const studies = [];
  for (const orthancId of orthancIds) {
    const metadata = await requestJson(orthancOrigin, `/studies/${encodeURIComponent(orthancId)}`);
    const studyInstanceUid = metadata.MainDicomTags?.StudyInstanceUID;
    if (typeof studyInstanceUid !== "string") throw new Error("STUDY_UID_MISSING");
    const [series, instances] = await Promise.all([
      requestJson(orthancOrigin, `/studies/${encodeURIComponent(orthancId)}/series`),
      requestJson(orthancOrigin, `/studies/${encodeURIComponent(orthancId)}/instances`),
    ]);
    if (!Array.isArray(series) || !Array.isArray(instances) || instances.length === 0) {
      throw new Error("STUDY_INVENTORY_INVALID");
    }
    studies.push({ orthancId, studyInstanceUid, seriesCount: series.length, instanceCount: instances.length });
  }
  return studies;
}

function summarize(studies) {
  return {
    studies: studies.length,
    series: studies.reduce((total, study) => total + study.seriesCount, 0),
    instances: studies.reduce((total, study) => total + study.instanceCount, 0),
    studyUids: studies.map((study) => study.studyInstanceUid).sort(),
  };
}

async function readCounts() {
  const [studies, series, instances] = await Promise.all([
    requestJson(orthancOrigin, "/studies"),
    requestJson(orthancOrigin, "/series"),
    requestJson(orthancOrigin, "/instances"),
  ]);
  if (![studies, series, instances].every(Array.isArray)) throw new Error("ORTHANC_EMPTY_CHECK_INVALID");
  return { studies: studies.length, series: series.length, instances: instances.length };
}

async function verifyMtlsQidoEmpty() {
  const options = {
    hostname: "orthanc-mtls",
    servername: "hospital-a-orthanc-mtls",
    port: 8443,
    path: "/dicom-web/studies",
    method: "GET",
    ...tls,
    rejectUnauthorized: true,
  };
  const { statusCode, body } = await new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
        if (data.length > 1048576) request.destroy(new Error("QIDO_RESPONSE_LIMIT"));
      });
      response.on("end", () => resolve({ statusCode: response.statusCode, body: data }));
      response.on("error", reject);
    });
    request.setTimeout(4000, () => request.destroy(new Error("QIDO_TIMEOUT")));
    const deadline = setTimeout(() => request.destroy(new Error("QIDO_DEADLINE")), 5000);
    request.on("close", () => clearTimeout(deadline));
    request.on("error", reject);
    request.end();
  });
  if (statusCode !== 200) return false;
  try { return Array.isArray(JSON.parse(body)) && JSON.parse(body).length === 0; }
  catch { return false; }
}

function requestJson(origin, pathname, method = "GET") {
  const url = new URL(pathname, origin);
  return new Promise((resolve, reject) => {
    const request = https.request(url, { ...tls, method, timeout: 4000 }, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
        if (data.length > 1048576) request.destroy(new Error("ORTHANC_RESPONSE_LIMIT"));
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`ORTHANC_HTTP_${response.statusCode}`));
          return;
        }
        if (!data) { resolve({ status: "Success" }); return; }
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("ORTHANC_JSON_INVALID")); }
      });
      response.on("error", reject);
    });
    request.setTimeout(4000, () => request.destroy(new Error("ORTHANC_TIMEOUT")));
    const deadline = setTimeout(() => request.destroy(new Error("ORTHANC_DEADLINE")), 5000);
    request.on("close", () => clearTimeout(deadline));
    request.on("error", reject);
    request.end();
  });
}

function safeReason(error) {
  const known = String(error?.message ?? "");
  return /^[A-Z0-9_]+$/.test(known) || /^ORTHANC_HTTP_[0-9]{3}$/.test(known) ? known : "REQUEST_FAILED";
}
