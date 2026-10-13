const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SCOPE = /^api:\/\/([0-9a-f-]{36})\/([A-Za-z0-9._:-]{1,128})$/iu;
const SYNTHETIC_ACTOR = /^synthetic-[a-z0-9-]{1,64}$/u;
const PATIENT_ID = /^MEDIQ-SYN-[A-Z0-9-]{1,64}$/u;
const DOCTOR_PATIENT_ID = /^(?:MEDIQ-SYN-[A-Z0-9-]{1,64}|P-[0-9]{1,8})$/u;
const DICOM_UID = /^(?:0|[1-9][0-9]{0,8})(?:\.(?:0|[1-9][0-9]{0,8}))+$/u;

export function validateEntraBrowserConfig(config, appOrigin) {
  if (!config || typeof config !== "object" || Array.isArray(config)
      || config.provider !== "ENTRA_OIDC" || config.synthetic !== true
      || typeof config.tenantId !== "string" || !GUID.test(config.tenantId)
      || typeof config.clientId !== "string" || !GUID.test(config.clientId)
      || typeof config.redirectUri !== "string" || !Array.isArray(config.scopes)
      || config.scopes.length !== 1 || typeof config.scopes[0] !== "string") {
    throw new Error("ENTRA_CONFIG_INVALID");
  }
  const scope = SCOPE.exec(config.scopes[0]);
  if (!scope || !GUID.test(scope[1])) throw new Error("ENTRA_CONFIG_INVALID");

  let appUrl;
  let redirectUrl;
  try {
    appUrl = new URL(appOrigin);
    redirectUrl = new URL(config.redirectUri);
  } catch {
    throw new Error("ENTRA_CONFIG_INVALID");
  }
  const localHttp = appUrl.protocol === "http:" && redirectUrl.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname)
    && redirectUrl.hostname === appUrl.hostname;
  if ((!localHttp && (appUrl.protocol !== "https:" || redirectUrl.protocol !== "https:"))
      || appUrl.origin !== redirectUrl.origin || redirectUrl.username || redirectUrl.password
      || redirectUrl.search || redirectUrl.hash || !redirectUrl.pathname.endsWith("/entra-redirect.html")) {
    throw new Error("ENTRA_CONFIG_INVALID");
  }
  return Object.freeze({
    provider: config.provider,
    tenantId: config.tenantId.toLowerCase(),
    clientId: config.clientId.toLowerCase(),
    redirectUri: redirectUrl.href,
    scopes: Object.freeze([config.scopes[0]]),
  });
}

export async function signInWithEntra({ config, msalModule, fetchImpl = globalThis.fetch, appOrigin, now = Date.now }) {
  const trustedConfig = validateEntraBrowserConfig(config, appOrigin);
  if (typeof msalModule?.PublicClientApplication !== "function" || typeof fetchImpl !== "function") {
    throw new Error("ENTRA_CLIENT_UNAVAILABLE");
  }

  let result;
  try {
    const client = new msalModule.PublicClientApplication({
      auth: {
        clientId: trustedConfig.clientId,
        authority: `https://login.microsoftonline.com/${trustedConfig.tenantId}`,
        redirectUri: trustedConfig.redirectUri,
      },
      cache: { cacheLocation: "memoryStorage" },
      system: { loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} } },
    });
    await client.initialize();
    result = await client.loginPopup({
      scopes: trustedConfig.scopes,
      redirectUri: trustedConfig.redirectUri,
      prompt: "select_account",
    });
  } catch {
    throw new Error("ENTRA_LOGIN_FAILED");
  }
  if (typeof result?.accessToken !== "string" || !result.accessToken
      || !(result.expiresOn instanceof Date) || !Number.isFinite(result.expiresOn.getTime())
      || result.expiresOn.getTime() <= now()) {
    throw new Error("ENTRA_ACCESS_TOKEN_INVALID");
  }

  let response;
  try {
    response = await fetchImpl("/api/capstone-demo/identity", {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${result.accessToken}` },
      cache: "no-store",
      credentials: "same-origin",
      mode: "same-origin",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error("ENTRA_IDENTITY_UNAVAILABLE");
  }
  if (!response.ok) throw new Error("ENTRA_IDENTITY_DENIED");
  let identity;
  try {
    identity = validateEntraSyntheticIdentity(await response.json());
  } catch {
    throw new Error("ENTRA_IDENTITY_INVALID");
  }

  const expiresAt = result.expiresOn.getTime();
  const accessToken = result.accessToken;
  return Object.freeze({
    roles: Object.freeze([identity.role]),
    context: Object.freeze(identity.demoContext),
    headers(role) {
      if (role !== identity.role) throw new Error("ENTRA_ROLE_NOT_MAPPED");
      if (now() >= expiresAt) {
        const error = new Error("ENTRA_SESSION_EXPIRED");
        error.code = "CAPSTONE_SESSION_EXPIRED";
        throw error;
      }
      return { authorization: `Bearer ${accessToken}` };
    },
  });
}

export function validateEntraSyntheticIdentity(identity) {
  const allowedTopLevel = ["authenticated", "synthetic", "actorId", "role", "demoContext"];
  if (!identity || typeof identity !== "object" || Array.isArray(identity)
      || Object.keys(identity).some((key) => !allowedTopLevel.includes(key))
      || identity.authenticated !== true || identity.synthetic !== true
      || !SYNTHETIC_ACTOR.test(identity.actorId)
      || !["PATIENT", "DOCTOR"].includes(identity.role)) {
    throw new Error("ENTRA_IDENTITY_INVALID");
  }
  const context = identity.demoContext;
  const allowedContext = ["patientId", "patientName", "defaultStudyUid", "entryRole", "scenario"];
  if (!context || typeof context !== "object" || Array.isArray(context)
      || Object.keys(context).some((key) => !allowedContext.includes(key))
      || context.entryRole !== identity.role
      || typeof context.patientId !== "string"
      || typeof context.patientName !== "string" || !context.patientName
      || typeof context.defaultStudyUid !== "string" || !DICOM_UID.test(context.defaultStudyUid)
      || (identity.role === "PATIENT" && !PATIENT_ID.test(context.patientId))
      || (identity.role === "DOCTOR" && !DOCTOR_PATIENT_ID.test(context.patientId))) {
    throw new Error("ENTRA_IDENTITY_INVALID");
  }
  return identity;
}
