import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  AuthError,
  AuthMode,
  EntraOidcProvider,
  authenticateRequest,
  validateAuthConfiguration,
  validateSyntheticActorMap,
} from "../src/auth.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const SPA_CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const API_AUDIENCE = "33333333-3333-4333-8333-333333333333";
const PATIENT_OID = "44444444-4444-4444-8444-444444444444";
const DOCTOR_OID = "55555555-5555-4555-8555-555555555555";
const UNKNOWN_OID = "66666666-6666-4666-8666-666666666666";
const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
const JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys";

const actorMap = {
  schemaVersion: 1,
  tenantId: TENANT_ID,
  actors: [
    { objectId: PATIENT_OID, actorId: "synthetic-patient-hcc", role: "PATIENT", patientId: "MEDIQ-SYN-HCC-001" },
    { objectId: DOCTOR_OID, actorId: "synthetic-doctor-b", role: "DOCTOR", doctorId: "DOC-B-01", hospitalId: "HOSP-B" },
  ],
};

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: "jwk" }), kid: "entra-test-key", alg: "RS256", use: "sig", key_ops: ["verify"] };

function createProvider({ jwksUri = JWKS_URL, keys = [publicJwk], discoveryIssuer = ISSUER, fetchImpl = null } = {}) {
  const requests = [];
  const fetcher = fetchImpl ?? (async url => {
    requests.push(String(url));
    if (String(url) === DISCOVERY_URL) {
      return new Response(JSON.stringify({ issuer: discoveryIssuer, jwks_uri: jwksUri, authorization_endpoint: `${ISSUER}/oauth2/v2.0/authorize`, token_endpoint: `${ISSUER}/oauth2/v2.0/token` }), { status: 200 });
    }
    if (String(url) === jwksUri) return new Response(JSON.stringify({ keys }), { status: 200 });
    return new Response("not found", { status: 404 });
  });
  const env = {
    AUTH_MODE: AuthMode.ENTRA_OIDC,
    ENTRA_TENANT_ID: TENANT_ID,
    ENTRA_SPA_CLIENT_ID: SPA_CLIENT_ID,
    ENTRA_API_AUDIENCE: API_AUDIENCE,
    ENTRA_API_SCOPE: "access_as_user",
  };
  return { provider: new EntraOidcProvider(env, { actorMap, fetchImpl: fetcher }), requests };
}

function token(claims = {}, { kid = "entra-test-key", alg = "RS256" } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg, typ: "JWT", kid };
  const payload = {
    iss: ISSUER,
    aud: API_AUDIENCE,
    ver: "2.0",
    tid: TENANT_ID,
    oid: PATIENT_OID,
    azp: SPA_CLIENT_ID,
    scp: "access_as_user",
    sub: "entra-subject-for-test-only",
    iat: now,
    nbf: now - 1,
    exp: now + 300,
    ...claims,
  };
  const input = [header, payload].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".");
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}

async function expectAuthError(promise, statusCode, code) {
  await assert.rejects(promise, error => error instanceof AuthError && error.statusCode === statusCode && error.code === code);
}

test("Entra OIDC maps only validated tenant/object IDs to fixed synthetic patient and doctor actors", async () => {
  const { provider } = createProvider();
  const patient = await provider.authenticate({ headers: { authorization: `Bearer ${token()}`, "x-hipass-role": "PLATFORM_ADMIN", "x-hipass-patient-id": "REAL-PATIENT" } });
  assert.equal(patient.authMode, AuthMode.ENTRA_OIDC);
  assert.equal(patient.authMethod, "ENTRA_OIDC_ACCESS_TOKEN");
  assert.equal(patient.subject, "synthetic-patient-hcc");
  assert.equal(patient.role, "PATIENT");
  assert.equal(patient.patientId, "MEDIQ-SYN-HCC-001");
  assert.deepEqual(patient.roles, ["PATIENT"]);
  assert.deepEqual(patient.scopes, ["consent:write", "consent:read"]);

  const doctor = await provider.authenticate({ headers: { authorization: `Bearer ${token({ oid: DOCTOR_OID, role: "PLATFORM_ADMIN", hospitalId: "HOSP-A" })}` } });
  assert.equal(doctor.subject, "synthetic-doctor-b");
  assert.equal(doctor.role, "DOCTOR");
  assert.equal(doctor.doctorId, "DOC-B-01");
  assert.equal(doctor.hospitalId, "HOSP-B");
});

test("Entra provider enforces tenant, client, API audience, delegated scope, and token version", async () => {
  const { provider } = createProvider();
  for (const [claims, code] of [
    [{ tid: UNKNOWN_OID }, "ENTRA_TENANT_INVALID"],
    [{ azp: UNKNOWN_OID }, "ENTRA_CLIENT_INVALID"],
    [{ ver: "1.0" }, "ENTRA_TOKEN_VERSION_INVALID"],
    [{ scp: "profile" }, "ENTRA_DELEGATED_SCOPE_REQUIRED"],
    [{ scp: undefined, idtyp: "app" }, "ENTRA_DELEGATED_SCOPE_REQUIRED"],
    [{ oid: "not-a-guid" }, "ENTRA_OBJECT_ID_INVALID"],
  ]) {
    const signedClaims = { ...claims };
    if (signedClaims.scp === undefined) delete signedClaims.scp;
    await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token(signedClaims)}` } }), 401, code);
  }
  await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token({ oid: UNKNOWN_OID, role: "PLATFORM_ADMIN" })}` } }), 403, "ENTRA_ACTOR_NOT_MAPPED");
});

test("Entra OIDC rejects wrong issuer, audience, expiry, timestamps, and unsupported algorithms", async () => {
  const { provider } = createProvider();
  await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token({ iss: "https://evil.example/v2.0" })}` } }), 401, "JWT_ISSUER_INVALID");
  await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token({ aud: UNKNOWN_OID })}` } }), 401, "JWT_AUDIENCE_INVALID");
  await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token({ exp: Math.floor(Date.now() / 1000) - 1 })}` } }), 401, "JWT_EXPIRED");
  await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token({ iat: "not-a-date" })}` } }), 401, "JWT_REGISTERED_CLAIMS_INVALID");
  await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token({}, { alg: "HS256" })}` } }), 401, "JWT_ALG_UNSUPPORTED");
});

test("Entra OIDC pins issuer discovery and JWKS to HTTPS login.microsoftonline.com", async () => {
  for (const jwksUri of ["http://login.microsoftonline.com/keys", "https://evil.example/keys"]) {
    const { provider } = createProvider({ jwksUri });
    await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token()}` } }), 503, "JWKS_URI_INVALID");
  }
  const { provider } = createProvider({ discoveryIssuer: "https://evil.example/v2.0" });
  await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token()}` } }), 401, "OIDC_ISSUER_DISCOVERY_MISMATCH");
});

test("Entra provider fails closed on unknown key, unavailable discovery, or absent bearer", async () => {
  const { provider } = createProvider();
  await expectAuthError(provider.authenticate({ headers: {} }), 401, "AUTHENTICATION_REQUIRED");
  await expectAuthError(provider.authenticate({ headers: { authorization: `Bearer ${token({}, { kid: "unknown-key" })}` } }), 401, "JWT_KID_UNKNOWN");
  const unavailable = createProvider({ fetchImpl: async () => { throw new Error("network unavailable"); } }).provider;
  await expectAuthError(unavailable.authenticate({ headers: { authorization: `Bearer ${token()}` } }), 503, "OIDC_DISCOVERY_UNAVAILABLE");
});

test("synthetic actor map rejects tenant mismatch, duplicates, elevated roles, and identity claims", () => {
  assert.throws(() => validateSyntheticActorMap({ ...actorMap, tenantId: UNKNOWN_OID }, TENANT_ID), error => error.code === "ENTRA_ACTOR_MAP_INVALID_CONFIGURATION");
  assert.throws(() => validateSyntheticActorMap({ ...actorMap, actors: [...actorMap.actors, actorMap.actors[0]] }, TENANT_ID), error => error.code === "ENTRA_ACTOR_MAP_INVALID_CONFIGURATION");
  assert.throws(() => validateSyntheticActorMap({ ...actorMap, actors: [
    { objectId: PATIENT_OID, actorId: "synthetic-admin", role: "PLATFORM_ADMIN", hospitalId: "HOSP-A" }, actorMap.actors[1],
  ] }, TENANT_ID), error => error.code === "ENTRA_ACTOR_MAP_INVALID_CONFIGURATION");
  assert.throws(() => validateSyntheticActorMap({ ...actorMap, actors: [
    { ...actorMap.actors[0], email: "not-authoritative@example.invalid" }, actorMap.actors[1],
  ] }, TENANT_ID), error => error.code === "ENTRA_ACTOR_MAP_INVALID_CONFIGURATION");
});

test("ENTRA_OIDC startup requires explicit tenant, app, scope, and actor-map configuration", () => {
  assert.throws(() => validateAuthConfiguration({ NODE_ENV: "production", AUTH_MODE: AuthMode.ENTRA_OIDC }), error => error instanceof AuthError && error.code === "ENTRA_TENANT_ID_REQUIRED");
  assert.throws(() => validateAuthConfiguration({
    NODE_ENV: "production",
    AUTH_MODE: AuthMode.ENTRA_OIDC,
    ENTRA_TENANT_ID: TENANT_ID,
    ENTRA_SPA_CLIENT_ID: SPA_CLIENT_ID,
    ENTRA_API_AUDIENCE: API_AUDIENCE,
    ENTRA_API_SCOPE: "access_as_user",
    ENTRA_REDIRECT_URI: "https://demo.example/",
  }), error => error instanceof AuthError && error.code === "HIPASS_ENTRA_ACTOR_MAP_FILE_REQUIRED");
});

test("authenticateRequest awaits Entra provider while preserving the internal service boundary", async () => {
  const { provider } = createProvider();
  const env = {
    AUTH_MODE: AuthMode.ENTRA_OIDC,
    ENTRA_TENANT_ID: TENANT_ID,
    ENTRA_SPA_CLIENT_ID: SPA_CLIENT_ID,
    ENTRA_API_AUDIENCE: API_AUDIENCE,
    ENTRA_API_SCOPE: "access_as_user",
  };
  const principal = await authenticateRequest({ headers: { authorization: `Bearer ${token()}` } }, env, provider);
  assert.equal(principal.role, "PATIENT");
});
