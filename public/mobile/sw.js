// HiPass MediQ Service Worker (PWA Offline App Shell Cache)
// Security Principle: Only static client assets (HTML, CSS, JS, Icons) are cached.
// Sensitive clinical data and API endpoints (/api/*) are NEVER stored in cache.

const CACHE_NAME = "hipass-mediq-shell-v49";

const APP_SHELL_ASSETS = [
  "/mobile/",
  "/mobile/index.html",
  "/mobile/style.css",
  "/ui/tokens.css",
  "/ui/components.css",
  "/ui/mobile.css",
  "/ui/faq-assistant.css",
  "/ui/faq-assistant.js",
  "/ui/faq-catalog.js",
  "/ui/brand.css",
  "/brand/mediq-source.png",
  "/mobile/app.js",
  "/login-navigation.js",
  "/auth-boot.css",
  "/mobile/health-helper.js",
  "/mobile/health-helper.css",
  "/ui/patient-helper.js",
  "/ui/patient-helper.css",
  "/ui/health-comparison.js",
  "/ui/health-comparison.css",
  "/ui/health-record-client.js",
  "/ui/wallet-home.js",
  "/ui/wallet-home.css",
  "/ui/wallet-open.css",
  "/ui/wallet-bifold.css",
  "/ui/wallet-record-sheet.css",
  "/ui/sharing-wallet-v2.css",
  "/images/mediq-wallet-model-back.webp",
  "/images/mediq-wallet-model-front.webp",
  "/images/mediq-wallet-model-mobile-back.webp",
  "/images/mediq-wallet-model-mobile-front.webp",
  "/images/mediq-wallet-bifold-v1.webp",
  "/ui/patient-health.js",
  "/ui/patient-sharing.js",
  "/ui/patient-health.css",
  "/ui/patient-library.js",
  "/ui/patient.js",
  "/qrcode.js",
  "/capstone-auth.js",
  "/ui/capstone-login.css",
  "/ui/demo-entry.js",
  "/ui/demo-entry.css",
  "/images/mediq-hong-gildong-landing.png",
  "/images/mediq-login-wallet.webp",
  "/images/mediq-wallet-front-v1.webp",
  "/images/mediq-wallet-leather-v1.webp",
  "/images/mediq-synthetic-abdominal-ct.png",
  "/patient-pixel-viewer.js",
  "/ui/patient-pixel-viewer.css",
  "/mobile/manifest.json",
  "/mobile/icon-192.png",
  "/mobile/icon-512.png",
  "/mobile/icon.svg"
];

// 1. Install Event: Precache Application Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(APP_SHELL_ASSETS.map(async asset => {
        const response = await fetch(asset, { credentials: "omit", cache: "reload", signal: AbortSignal.timeout(10000) });
        if (response.status !== 200 || response.type === "opaque") throw new Error("APP_SHELL_UNAVAILABLE");
        await cache.put(asset, response);
      }));
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name.startsWith("hipass-mediq-shell-") && name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Routing & Cache Strategy
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Exclude non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Exact public shell allowlist only; never handle credentials, query-bearing
  // URLs, DICOMweb or arbitrary /mobile/* responses through the cache.
  if (requestUrl.origin !== self.location.origin || requestUrl.search ||
      event.request.headers.has("authorization") ||
      !APP_SHELL_ASSETS.includes(requestUrl.pathname)) {
    return;
  }

  // Network first prevents an old role-header client surviving a deployment.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request, { signal: AbortSignal.timeout(10000) });
        if (response.status === 200 && response.type !== "opaque") await cache.put(event.request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const shell = await cache.match("/mobile/index.html");
          if (shell) return shell;
        }
        return Response.error();
      }
    })()
  );
});
