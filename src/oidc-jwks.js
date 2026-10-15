import { createPublicKey, createVerify } from "node:crypto";
import { AuthError } from "./auth.js";

export class JwksCache {
  constructor({ ttlMs = 60_000, fetchImpl = globalThis.fetch } = {}) {
    this.ttlMs = ttlMs;
    this.fetchImpl = fetchImpl;
    this.entries = new Map();
  }

  async getSigningKey({ discoveryUrl, issuer, kid, forceRefresh = false, allowedJwksHostname = null }) {
    if (!kid) throw new AuthError(401, "JWT_KID_REQUIRED", "JWT kid is required");
    const cacheKey = discoveryUrl ?? issuer;
    const cached = this.entries.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now() && cached.keys.has(kid)) {
      return cached.keys.get(kid);
    }
    const discovery = await fetchOidcDiscovery(discoveryUrl, this.fetchImpl);
    if (issuer && discovery.issuer !== issuer) {
      throw new AuthError(401, "OIDC_ISSUER_DISCOVERY_MISMATCH", "OIDC issuer discovery mismatch");
    }
    if (allowedJwksHostname) {
      let jwksUrl;
      try { jwksUrl = new URL(discovery.jwks_uri); } catch { throw new AuthError(503, "JWKS_URI_INVALID"); }
      if (jwksUrl.protocol !== "https:" || jwksUrl.hostname !== allowedJwksHostname || jwksUrl.username || jwksUrl.password) {
        throw new AuthError(503, "JWKS_URI_INVALID");
      }
    }
    const jwks = await fetchJwks(discovery.jwks_uri, this.fetchImpl);
    const keys = new Map();
    for (const jwk of jwks.keys ?? []) {
      if (jwk.kid && jwk.kty === "RSA" && (!jwk.use || jwk.use === "sig")
          && (!jwk.alg || jwk.alg === "RS256") && (!jwk.key_ops || jwk.key_ops.includes("verify"))) {
        if (keys.has(jwk.kid)) throw new AuthError(503, "JWKS_DUPLICATE_KID");
        try { keys.set(jwk.kid, createPublicKey({ key: jwk, format: "jwk" })); } catch { /* Ignore malformed provider keys; fail closed if no matching key remains. */ }
      }
    }
    this.entries.set(cacheKey, { keys, expiresAt: Date.now() + this.ttlMs, discovery });
    if (!keys.has(kid)) throw new AuthError(401, "JWT_KID_UNKNOWN", "JWT kid is unknown");
    return keys.get(kid);
  }
}

export async function fetchOidcDiscovery(discoveryUrl, fetchImpl = globalThis.fetch) {
  if (!discoveryUrl) throw new AuthError(500, "OIDC_DISCOVERY_URL_REQUIRED", "OIDC discovery URL is required");
  const response = await fetchJsonResponse(discoveryUrl, fetchImpl, "OIDC_DISCOVERY_UNAVAILABLE");
  if (!response.ok) throw new AuthError(503, "OIDC_DISCOVERY_UNAVAILABLE", "OIDC discovery is unavailable");
  const body = await response.json().catch(() => { throw new AuthError(503, "OIDC_DISCOVERY_INVALID"); });
  for (const field of ["issuer", "jwks_uri", "authorization_endpoint", "token_endpoint"]) {
    if (!body[field]) throw new AuthError(503, "OIDC_DISCOVERY_INCOMPLETE", `OIDC discovery missing ${field}`);
  }
  return body;
}

export async function fetchJwks(jwksUri, fetchImpl = globalThis.fetch) {
  const response = await fetchJsonResponse(jwksUri, fetchImpl, "JWKS_UNAVAILABLE");
  if (!response.ok) throw new AuthError(503, "JWKS_UNAVAILABLE", "JWKS is unavailable");
  const body = await response.json().catch(() => { throw new AuthError(503, "JWKS_INVALID"); });
  if (!Array.isArray(body.keys)) throw new AuthError(503, "JWKS_INVALID", "JWKS keys are invalid");
  return body;
}

export async function verifyJwtWithJwks(token, options) {
  const [encodedHeader, encodedPayload, signature] = String(token).split(".");
  if (!encodedHeader || !encodedPayload || !signature) throw new AuthError(401, "JWT_INVALID", "JWT is malformed");
  const header = parseJson(encodedHeader);
  if (header.alg !== "RS256") throw new AuthError(401, "JWT_ALG_UNSUPPORTED", "JWT algorithm is unsupported");
  const claims = parseJson(encodedPayload);
  const cache = options.cache ?? new JwksCache({ fetchImpl: options.fetchImpl });
  let publicKey = await cache.getSigningKey({
    discoveryUrl: options.discoveryUrl,
    issuer: options.issuer,
    kid: header.kid,
    allowedJwksHostname: options.allowedJwksHostname,
  });
  if (!verifyRs256(`${encodedHeader}.${encodedPayload}`, signature, publicKey)) {
    publicKey = await cache.getSigningKey({
      discoveryUrl: options.discoveryUrl,
      issuer: options.issuer,
      kid: header.kid,
      forceRefresh: true,
      allowedJwksHostname: options.allowedJwksHostname,
    });
    if (!verifyRs256(`${encodedHeader}.${encodedPayload}`, signature, publicKey)) {
      throw new AuthError(401, "JWT_INVALID_SIGNATURE", "JWT signature is invalid");
    }
  }
  validateClaims(claims, options);
  return claims;
}

function verifyRs256(signingInput, signature, publicKey) {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(signingInput);
  verifier.end();
  return verifier.verify(publicKey, signature, "base64url");
}

function validateClaims(claims, options) {
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.sub !== "string" || !claims.sub) throw new AuthError(401, "JWT_SUB_REQUIRED", "JWT sub is required");
  if (typeof claims.exp !== "number" || !Number.isSafeInteger(claims.exp)
      || ["iat", "nbf"].some(key => claims[key] !== undefined && (!Number.isSafeInteger(claims[key]) || claims[key] < 0))) {
    throw new AuthError(401, "JWT_REGISTERED_CLAIMS_INVALID");
  }
  if (options.issuer && claims.iss !== options.issuer) throw new AuthError(401, "JWT_ISSUER_INVALID", "JWT issuer is invalid");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (options.audience && !audiences.includes(options.audience)) throw new AuthError(401, "JWT_AUDIENCE_INVALID", "JWT audience is invalid");
  if (claims.exp <= now) throw new AuthError(401, "JWT_EXPIRED", "JWT is expired");
  if (claims.nbf !== undefined && claims.nbf > now) throw new AuthError(401, "JWT_NOT_YET_VALID", "JWT is not yet valid");
  if (claims.iat !== undefined && claims.iat > now + 60) throw new AuthError(401, "JWT_IAT_INVALID");
}

async function fetchJsonResponse(url, fetchImpl, failureCode) {
  try {
    return await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  } catch {
    throw new AuthError(503, failureCode);
  }
}

function parseJson(encoded) {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new AuthError(401, "JWT_INVALID", "JWT JSON is invalid");
  }
}
