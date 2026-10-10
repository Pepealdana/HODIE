const CACHE = "hodie-shell-v22";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/brand/hodie-logo.png",
  "./assets/brand/hodie-logo-dark.png",
  "./assets/brand/hodie-symbol.png",
  "./assets/brand/hodie-symbol-dark.png",
  "./assets/icons/icon-light-16.png",
  "./assets/icons/icon-light-32.png",
  "./assets/icons/icon-light-64.png",
  "./assets/icons/icon-light-180.png",
  "./assets/icons/icon-light-192.png",
  "./assets/icons/icon-light-512.png",
  "./assets/icons/icon-dark-16.png",
  "./assets/icons/icon-dark-32.png",
  "./assets/icons/icon-dark-64.png",
  "./assets/icons/icon-dark-180.png",
  "./assets/icons/icon-dark-192.png",
  "./assets/icons/icon-dark-512.png",
  "./data/can-do-matrix.json",
  "./data/content-library.json",
  "./data/micro-practice-library.json",
  "./data/experience-library.json",
  "./data/learning-contexts.json",
  "./data/practice-taxonomy.json",
  "./data/error-model.json",
  "./data/feedback-model.json",
  "./data/evidence-model.json",
  "./data/progress-model.json",
  "./data/content-model.json",
  "./data/knowledge-library.json",
  "./data/linguistic-catalog.json",
  "./data/integrated-units.json",
  "./src/activity-generator.js",
  "./src/adaptive-planner.js",
  "./src/communication-repair.js",
  "./src/conversation-provider.js",
  "./src/error-engine.js",
  "./src/error-memory.js",
  "./src/evidence-boundary.js",
  "./src/experience-engine.js",
  "./src/feedback-contract.js",
  "./src/learning-budget.js",
  "./src/learning-context.js",
  "./src/learning-engine.js",
  "./src/linguistic-engine.js",
  "./src/learning-orchestrator.js",
  "./src/learning-planner.js",
  "./src/learning-session.js",
  "./src/learning-profile.js",
  "./src/knowledge-graph.js",
  "./src/integrated-unit.js",
  "./src/longitudinal-model.js",
  "./src/micro-practice.js",
  "./src/progression-retention.js",
  "./src/session-composer.js",
  "./src/session-runner.js",
  "./src/session-state.js",
  "./src/skill-graph.js",
  "./src/transfer-engine.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;
  const isAppCodeOrData = /\.(?:html|css|js|json|webmanifest)$/.test(pathname);
  const isNavigation = event.request.mode === "navigate";

  // Network-first for app code, data, and navigation. Online clients receive
  // current files; the last successful response remains available offline.
  if (isAppCodeOrData || isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (isNavigation) {
            const shell = await caches.match("./index.html");
            if (shell) return shell;
          }
          return Response.error();
        })
    );
    return;
  }

  // Cache-first for static assets such as icons and logos; fetch on cache miss.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
