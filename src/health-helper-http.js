import { AuthError } from './auth.js';
import { HelperError } from './health-helper-rag.js';
import { readJson, RequestBodyError, sendJson } from './http-utils.js';

export const HEALTH_HELPER_PATH = '/api/v1/me/health-helper/questions';
export function createHealthHelperHandler({helper, authenticate, requestMeta, audit, requireTrustedIngress = false}) {
  return async (request, response, url) => {
    if (url.pathname !== HEALTH_HELPER_PATH) return false;
    let principal; let delegated = false;
    try {
      principal = await authenticate(request);
      const meta = requestMeta(request, principal);
      if (requireTrustedIngress && !meta.ingressTrusted) throw new HelperError(403, 'TRUSTED_INGRESS_REQUIRED');
      if (request.method !== 'POST') throw new HelperError(405, 'METHOD_NOT_ALLOWED');
      if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) throw new HelperError(415, 'JSON_REQUIRED');
      const body = await readJson(request, {maxBytes:4096, strictUtf8:true});
      delegated = true;
      sendJson(response, 200, await helper.ask(principal, body));
    } catch (error) {
      const known = error instanceof HelperError || error instanceof AuthError || error instanceof RequestBodyError;
      let status = known ? error.statusCode : 503;
      let code = known ? error.code : 'HELPER_UNAVAILABLE';
      if (!delegated) {
        try { await audit({actorType:principal?.role ?? 'UNKNOWN',actorId:principal?.subject ?? 'unauthenticated',
          action:'HEALTH_HELPER_REQUEST',result:'FAIL',reasonCode:code}); }
        catch { status = 503; code = 'HELPER_UNAVAILABLE'; }
      }
      sendJson(response, status, {error:code});
    }
    return true;
  };
}
