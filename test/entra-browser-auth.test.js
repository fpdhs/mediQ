import test from "node:test";
import assert from "node:assert/strict";
import { signInWithEntra, validateEntraBrowserConfig, validateEntraSyntheticIdentity } from "../public/entra-auth.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const API_ID = "33333333-3333-4333-8333-333333333333";
const ORIGIN = "https://synthetic-demo.example";
const config = Object.freeze({
  provider: "ENTRA_OIDC",
  synthetic: true,
  tenantId: TENANT_ID,
  clientId: CLIENT_ID,
  redirectUri: `${ORIGIN}/entra-redirect.html`,
  scopes: [`api://${API_ID}/access_as_user`],
});
const patientIdentity = Object.freeze({
  authenticated: true,
  synthetic: true,
  actorId: "synthetic-patient-hcc",
  role: "PATIENT",
  demoContext: {
    patientId: "MEDIQ-SYN-HCC-001",
    patientName: "홍길동",
    defaultStudyUid: "1.2.410.100.1.20260620.001",
    entryRole: "PATIENT",
    scenario: { age: 56 },
  },
});

test("browser Entra config is tenant-bound and same-origin with one delegated API scope", () => {
  const trusted = validateEntraBrowserConfig(config, ORIGIN);
  assert.equal(trusted.synthetic, true);
  assert.equal(trusted.tenantId, TENANT_ID);
  assert.deepEqual(trusted.scopes, config.scopes);
  assert.throws(() => validateEntraBrowserConfig({ ...config, redirectUri: "https://evil.example/entra-redirect.html" }, ORIGIN), /ENTRA_CONFIG_INVALID/u);
  assert.throws(() => validateEntraBrowserConfig({ ...config, redirectUri: `${ORIGIN}/entra-redirect.html?next=https://evil.example` }, ORIGIN), /ENTRA_CONFIG_INVALID/u);
  assert.throws(() => validateEntraBrowserConfig({ ...config, scopes: ["User.Read"] }, ORIGIN), /ENTRA_CONFIG_INVALID/u);
  assert.throws(() => validateEntraBrowserConfig({ ...config, tenantId: "common" }, ORIGIN), /ENTRA_CONFIG_INVALID/u);
});

test("MSAL uses memory cache, fixed tenant authority and server-mapped role; token stays closure-only", async () => {
  let capturedClientConfig;
  let capturedLoginRequest;
  let capturedFetch;
  let clock = Date.now();
  class FakePublicClientApplication {
    constructor(value) { capturedClientConfig = value; }
    async initialize() {}
    async loginPopup(value) {
      capturedLoginRequest = value;
      return { accessToken: "SYNTHETIC-ACCESS-TOKEN", idToken: "NEVER-SEND-ID-TOKEN", expiresOn: new Date(clock + 5000) };
    }
  }
  const session = await signInWithEntra({
    // Exercise the same normalized config that initializeCapstoneAuth passes
    // into the login helper after its initial server-config validation.
    config: validateEntraBrowserConfig(config, ORIGIN),
    msalModule: { PublicClientApplication: FakePublicClientApplication },
    appOrigin: ORIGIN,
    now: () => clock,
    fetchImpl: async (url, options) => {
      capturedFetch = { url, options };
      return { ok: true, json: async () => patientIdentity };
    },
  });

  assert.equal(capturedClientConfig.auth.authority, `https://login.microsoftonline.com/${TENANT_ID}`);
  assert.equal(capturedClientConfig.cache.cacheLocation, "memoryStorage");
  assert.equal(capturedClientConfig.system.loggerOptions.piiLoggingEnabled, false);
  assert.deepEqual(capturedLoginRequest.scopes, config.scopes);
  assert.equal(capturedLoginRequest.redirectUri, config.redirectUri);
  assert.equal(capturedLoginRequest.prompt, "select_account");
  assert.equal(capturedFetch.url, "/api/capstone-demo/identity");
  assert.equal(capturedFetch.options.headers.authorization, "Bearer SYNTHETIC-ACCESS-TOKEN");
  assert.equal(capturedFetch.options.cache, "no-store");
  assert.equal(capturedFetch.options.mode, "same-origin");
  assert.deepEqual(session.roles, ["PATIENT"]);
  assert.equal(session.context.patientId, "MEDIQ-SYN-HCC-001");
  assert.deepEqual(session.headers("PATIENT"), { authorization: "Bearer SYNTHETIC-ACCESS-TOKEN" });
  assert.throws(() => session.headers("DOCTOR"), /ENTRA_ROLE_NOT_MAPPED/u);
  assert.equal(Object.hasOwn(session, "accessToken"), false);
  clock += 5000;
  assert.throws(() => session.headers("PATIENT"), error => error.code === "CAPSTONE_SESSION_EXPIRED");
});

test("browser refuses attacker-controlled roles, actor context and malformed access-token response", async () => {
  assert.throws(() => validateEntraSyntheticIdentity({
    ...patientIdentity,
    role: "PLATFORM_ADMIN",
  }), /ENTRA_IDENTITY_INVALID/u);
  assert.throws(() => validateEntraSyntheticIdentity({
    ...patientIdentity,
    demoContext: { ...patientIdentity.demoContext, patientId: "REAL-PATIENT-001" },
  }), /ENTRA_IDENTITY_INVALID/u);
  assert.throws(() => validateEntraSyntheticIdentity({ ...patientIdentity, doctorId: "DOC-ADMIN" }), /ENTRA_IDENTITY_INVALID/u);

  class InvalidTokenClient {
    constructor() {}
    async initialize() {}
    async loginPopup() { return { accessToken: "", expiresOn: new Date(Date.now() + 60000) }; }
  }
  await assert.rejects(signInWithEntra({
    config,
    msalModule: { PublicClientApplication: InvalidTokenClient },
    appOrigin: ORIGIN,
    fetchImpl: async () => { throw new Error("must not be called"); },
  }), /ENTRA_ACCESS_TOKEN_INVALID/u);
});
