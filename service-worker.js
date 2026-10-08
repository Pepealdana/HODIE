const CACHE = "hodie-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
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
