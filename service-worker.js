const CACHE = "hodie-shell-v6";
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
  "./src/activity-generator.js",
  "./src/adaptive-planner.js",
  "./src/communication-repair.js",
  "./src/conversation-provider.js",
  "./src/error-engine.js",
  "./src/error-memory.js",
  "./src/evidence-boundary.js",
  "./src/experience-engine.js",
  "./src/learning-budget.js",
  "./src/learning-context.js",
  "./src/learning-engine.js",
  "./src/learning-orchestrator.js",
  "./src/learning-planner.js",
  "./src/learning-session.js",
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
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
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
  const isShellCode = pathname.endsWith("/index.html")
    || pathname.endsWith("/styles.css")
    || pathname.endsWith("/app.js")
    || pathname.endsWith("/service-worker.js");

  // Keep HTML/CSS/JS fresh so local and network origins do not remain
  // on different app versions during development. Offline falls back to cache.
  if (isShellCode || event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
