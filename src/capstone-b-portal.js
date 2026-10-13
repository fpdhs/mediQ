import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { boundedHttps, boundedHelperHttps } from "./data-plane-gateway.js";
import { parseDataPlaneRequest } from "./data-plane-authorization.js";
import { parsePatientDataPlaneRequest } from './patient-self-view-authorization.js';
import { beginRuntimeDiagnostic } from "./capstone-runtime-diagnostics.js";

export function createCapstoneBPortal({ root, ca, origin = "https://192.168.111.149:9443", transport = boundedHttps, encryptionRequired = false, imageDecryption, diagnosticFactory, patientSelfViewEnabled=false,patientImageDecryption, pacsReceiver, entraLoginEnabled = false }) {
  if (origin !== "https://192.168.111.149:9443") throw new Error("CAPSTONE_PRESENTATION_ORIGIN_MISMATCH");
  root = path.resolve(root);
  if (encryptionRequired && typeof imageDecryption?.open !== "function") throw new Error("IMAGE_DECRYPTION_REQUIRED");
  return async (request, response) => {
    const diagnostic = beginRuntimeDiagnostic(diagnosticFactory);
    const fail = (status, code) => {
      diagnostic.finish(status);
      if (!response.headersSent && !response.destroyed) {
        response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
        response.end(JSON.stringify({ error: code }));
      }
    };
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("cache-control", "no-store");
    const entraConnect = entraLoginEnabled === true ? ' https://login.microsoftonline.com' : '';
    response.setHeader("content-security-policy", `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${entraConnect}; worker-src 'self' blob:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`);
    const raw = request.url ?? "";
    if (raw.length > 4096 || !raw.startsWith("/") || raw.startsWith("//") || /(?:^|[?&])(?:token|access_token|jwt|key)=/i.test(raw)) { request.resume(); return fail(400, "UNSAFE_URL"); }
    const pathname = raw.split("?")[0];
    if (!/^\/[A-Za-z0-9_./-]*$/.test(pathname) || pathname.includes("..")) { request.resume(); return fail(400, "UNSAFE_PATH"); }
    try {
      const importing = pathname.startsWith('/dicomweb/') && pathname.endsWith('/import');
      if (importing) {
        if (request.method !== 'POST' || request.headers.origin !== origin) { request.resume(); return fail(403, 'PACS_IMPORT_ORIGIN_OR_METHOD_INVALID'); }
        if (!encryptionRequired || typeof pacsReceiver?.receive !== 'function') { request.resume(); return fail(503, 'B_PACS_IMPORT_NOT_READY'); }
        if (!/^DPoP [A-Za-z0-9_.-]+$/u.test(request.headers.authorization ?? '') || typeof request.headers.dpop !== 'string') { request.resume(); return fail(401, 'PACS_IMPORT_PROOF_REQUIRED'); }
        let length = 0;
        for await (const chunk of request) { length += chunk.length; if (length) return fail(400, 'PACS_IMPORT_BODY_NOT_ALLOWED'); }
        const route = parseDataPlaneRequest({ method: 'POST', path: raw }, origin);
        const result = await transport('https://10.90.88.2:9443', raw, { method: 'POST', tls: { ca },
          headers: { authorization: request.headers.authorization, dpop: request.headers.dpop }, timeoutMs: 10000, maxBytes: 12582912 });
        if (result.status !== 200) { diagnostic.finish(result.status); response.writeHead(result.status, { 'content-type': result.contentType }); response.end(result.body); return; }
        const decoded = await imageDecryption.open(result, raw, { method: 'POST' });
        try {
          const receipt = await pacsReceiver.receive({ decoded, route });
          diagnostic.finish(200); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(receipt));
        } finally { decoded.body.fill(0); result.body.fill(0); }
        return;
      }
      const patientRoute=pathname.startsWith('/patient-dicomweb/');
      if(patientRoute){
        if(patientSelfViewEnabled!==true){request.resume();return fail(503,'PATIENT_GATEWAY_DISABLED');}
        let parsed;try{parsed=parsePatientDataPlaneRequest({method:request.method,path:raw},origin);}catch{request.resume();return fail(400,'PATIENT_ROUTE_INVALID');}
        if(['instance','frame'].includes(parsed.kind) && !pathname.endsWith('/metadata') && typeof patientImageDecryption?.openPatient!=='function'){request.resume();return fail(503,'PATIENT_KEY_RELEASE_NOT_READY');}
      }
      if (patientRoute || pathname.startsWith("/api/") || pathname.startsWith("/dicomweb/")) {
        if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)) { request.resume(); return fail(405, "METHOD_NOT_ALLOWED"); }
        if (request.method !== "GET" && request.headers.origin !== origin) { request.resume(); return fail(403, "ORIGIN_REQUIRED"); }
        const headers = {};
        for (const name of ["authorization", "dpop", "content-type", "accept", "idempotency-key"]) if (typeof request.headers[name] === "string") headers[name] = request.headers[name];
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 512 * 1024) return fail(413, "REQUEST_TOO_LARGE");
          chunks.push(chunk);
        }
        const upstream = patientRoute || pathname.startsWith("/dicomweb/") ? "https://10.90.88.2:9443" : "https://10.90.88.1";
        diagnostic.stage(pathname.startsWith("/dicomweb/") ? "UPSTREAM_IMAGE" : "UPSTREAM_METADATA");
        const helperRequest = request.method === 'POST' && raw === '/api/v1/me/health-helper/questions';
        const forward = helperRequest && transport === boundedHttps ? boundedHelperHttps : transport;
        const result = await forward(upstream, raw, { tls: { ca }, method: request.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined, timeoutMs: helperRequest ? 65000 : 10000, maxBytes: helperRequest ? 32768 : 33554432 });
        if(patientRoute && result.status===200){
          const route=parsePatientDataPlaneRequest({method:request.method,path:raw},origin);
          if(['instance','frame'].includes(route.kind) && !pathname.endsWith('/metadata')){
            const match=headers.authorization?.match(/^DPoP ([A-Za-z0-9_.-]+)$/);
            if(!match)return fail(403,'PATIENT_PROOF_REQUIRED');
            const decoded=await patientImageDecryption.openPatient(result,raw,{token:match[1]});
            if(response.destroyed){decoded.body.fill(0);return;}
            response.once('close',()=>decoded.body.fill(0));diagnostic.finish(200);
            response.writeHead(200,{'content-type':decoded.contentType,'cache-control':'no-store','content-disposition':'inline'});
            response.end(decoded.body,()=>decoded.body.fill(0));return;
          }
        }
        if (encryptionRequired && result.status === 200 && pathname.startsWith("/dicomweb/") && !pathname.endsWith("/metadata")) {
          const route = parseDataPlaneRequest({ method: request.method, path: raw }, origin);
          if (["instance", "frame"].includes(route.kind)) {
            diagnostic.stage("IMAGE_DECRYPTION");
            const decoded = await imageDecryption.open(result, raw);
            if (response.destroyed) { decoded.body.fill(0); return; }
            response.once("close", () => decoded.body.fill(0));
            diagnostic.finish(200);
            response.writeHead(200, { "content-type": decoded.contentType, "cache-control": "no-store", "content-disposition": pathname.endsWith("/download") ? "attachment" : "inline" });
            response.end(decoded.body, () => decoded.body.fill(0));
            return;
          }
        }
        diagnostic.finish(result.status);
        response.writeHead(result.status, { "content-type": result.contentType, "cache-control": "no-store" });
        response.end(result.body);
        return;
      }
      if (request.method !== "GET") { request.resume(); return fail(405, "METHOD_NOT_ALLOWED"); }
      let file = ["/", "/hipass", "/hipass/"].includes(pathname) ? "index.html" : ["/mobile", "/mobile/"].includes(pathname) ? "mobile/index.html" : pathname.slice(1);
      const mobileManifest = file === "mobile/manifest.json";
      const patientFont = file === "fonts/pretendard/PretendardVariable.woff2";
      if (file.startsWith("assets/clinical/") || (!mobileManifest && !patientFont && !/\.(?:html|js|css|png|jpg|jpeg|webp|svg|ico)$/.test(file))) return fail(404, "STATIC_NOT_FOUND");
      const target = path.resolve(root, file);
      if (!target.startsWith(root + path.sep) || !statSync(target).isFile() || statSync(target).size > 2097152) return fail(404, "STATIC_NOT_FOUND");
      let body = readFileSync(target);
      if (["index.html", "mobile/index.html"].includes(file)) body = Buffer.from(body.toString("utf8").replace('<html lang="ko">', '<html lang="ko" data-capstone="1">'));
      const extension = path.extname(file);
      const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2" };
      response.writeHead(200, { "content-type": mobileManifest ? "application/manifest+json; charset=utf-8" : types[extension] });
      response.end(body);
    } catch (error) { diagnostic.finish(503,error); fail(503, "CAPSTONE_PORTAL_UNAVAILABLE"); }
  };
}
