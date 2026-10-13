import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const publicRoot = path.join(projectRoot, "public");
const syntheticConfig = {
  provider: "ENTRA_OIDC",
  synthetic: true,
  tenantId: "11111111-1111-4111-8111-111111111111",
  clientId: "22222222-2222-4222-8222-222222222222",
  redirectUri: "http://127.0.0.1/entra-redirect.html",
  scopes: ["api://33333333-3333-4333-8333-333333333333/access_as_user"],
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (request.method !== "GET") {
    response.writeHead(405, { "cache-control": "no-store" });
    response.end();
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://login.microsoftonline.com; frame-src 'self' https://login.microsoftonline.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    response.end("<!doctype html><html lang=\"ko\" data-capstone=\"1\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>합성 Entra UI 검증</title><link rel=\"stylesheet\" href=\"/styles.css\"></head><body><script type=\"module\" src=\"/fixture-entry.js\"></script></body></html>");
    return;
  }
  if (url.pathname === "/fixture-entry.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    response.end("import { initializeCapstoneAuth } from '/capstone-auth.js'; window.__capstoneAuth = await initializeCapstoneAuth(); document.documentElement.dataset.fixtureReady='1';");
    return;
  }
  if (url.pathname === "/api/capstone-demo/auth-config") {
    const config = { ...syntheticConfig, redirectUri: `${url.origin}/entra-redirect.html` };
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify(config));
    return;
  }
  if (url.pathname === "/vendor/msal-browser.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    response.end("export class PublicClientApplication { constructor(config) { window.__testMsalConfig = config; } async initialize() {} async loginPopup(request) { window.__testMsalRequest = request; return { accessToken: 'SYNTHETIC-TEST-TOKEN', expiresOn: new Date(Date.now() + 60000) }; } }");
    return;
  }
  if (url.pathname === "/api/capstone-demo/identity") {
    if (request.headers.authorization !== "Bearer SYNTHETIC-TEST-TOKEN") {
      response.writeHead(401, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ error: "AUTHENTICATION_REQUIRED" }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ authenticated: true, synthetic: true, actorId: "synthetic-patient-hcc", role: "PATIENT",
      demoContext: { patientId: "MEDIQ-SYN-HCC-001", patientName: "홍길동", defaultStudyUid: "1.2.410.100.1.20260620.001",
        entryRole: "PATIENT", scenario: { age: 56 } } }));
    return;
  }

  let file;
  try { file = decodeURIComponent(url.pathname.slice(1)); } catch {
    response.writeHead(400); response.end(); return;
  }
  const target = path.resolve(publicRoot, file);
  if (!target.startsWith(`${publicRoot}${path.sep}`)) {
    response.writeHead(404); response.end(); return;
  }
  try {
    const body = await readFile(target);
    const contentType = path.extname(target) === ".css" ? "text/css; charset=utf-8"
      : path.extname(target) === ".js" ? "text/javascript; charset=utf-8"
        : path.extname(target) === ".woff2" ? "font/woff2"
          : path.extname(target) === ".svg" ? "image/svg+xml"
            : "application/octet-stream";
    response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404, { "cache-control": "no-store" });
    response.end();
  }
});

server.listen(0, "127.0.0.1", () => {
  console.log(`FIXTURE_LISTENING http://127.0.0.1:${server.address().port}`);
});
process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
