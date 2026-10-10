import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const index = read("index.html");
const app = read("app.js");
const manifest = JSON.parse(read("manifest.webmanifest"));
const worker = read("service-worker.js");

assert.match(index, /manifest\.webmanifest/);
assert.match(index, /theme-color/);
assert.match(index, /assets\/brand\/hodie-logo\.png/);
assert.match(index, /assets\/brand\/hodie-logo-dark\.png/);
assert.match(index, /assets\/icons\/icon-light-32\.png/);
assert.match(index, /assets\/icons\/icon-light-180\.png/);

assert.equal(manifest.name, "HODIE — Today. Not tomorrow.");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.scope, "./");
assert.equal(manifest.icons?.length, 2);
assert.equal(manifest.icons[0].src, "./assets/icons/icon-light-192.png");
assert.equal(manifest.icons[1].src, "./assets/icons/icon-light-512.png");
assert.ok(manifest.icons.every((icon) => icon.type === "image/png"));

assert.match(worker, /skipWaiting/);
assert.match(worker, /clients\.claim/);
assert.match(worker, /hodie-shell-v15/);
assert.match(worker, /assets\/brand\/hodie-logo\.png/);
assert.match(worker, /assets\/brand\/hodie-logo-dark\.png/);
assert.match(worker, /assets\/icons\/icon-light-512\.png/);
assert.match(worker, /src\/learning-engine\.js/);
assert.match(worker, /src\/session-runner\.js/);
assert.match(worker, /data\/knowledge-library\.json/);
assert.match(worker, /data\/integrated-units\.json/);
assert.match(worker, /src\/knowledge-graph\.js/);
assert.match(worker, /src\/learning-profile\.js/);
assert.match(worker, /src\/integrated-unit\.js/);
assert.match(app, /registration\.update\(\)/);
assert.match(app, /updateViaCache:\s*"none"/);
assert.doesNotMatch(worker, /assets\/icon\.svg/);
assert.doesNotMatch(index, /assets\/icon\.svg/);
assert.doesNotMatch(JSON.stringify(manifest), /assets\/icon\.svg/);

// Every precached local resource must exist. This prevents cache.addAll()
// from failing the entire install because one stale path was left behind.
const shellMatch = worker.match(/const APP_SHELL = \[([\s\S]*?)\];/);
assert.ok(shellMatch, "APP_SHELL list must be declared");
const shellResources = [...shellMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.ok(shellResources.includes("./data/knowledge-library.json"));
assert.ok(shellResources.includes("./data/integrated-units.json"));
assert.equal(new Set(shellResources).size, shellResources.length, "APP_SHELL must not contain duplicate paths");

for (const resource of shellResources) {
  if (resource === "./") continue;
  const localPath = path.join(root, resource.replace(/^\.\//, ""));
  assert.equal(fs.existsSync(localPath), true, `Missing precached resource: ${resource}`);
}

// Every relative JavaScript module imported by app.js must be available offline.
const imports = [...app.matchAll(/from\s+["'](\.\/src\/[^"']+)["']/g)].map((match) => match[1]);
for (const importedPath of imports) {
  assert.ok(shellResources.includes(importedPath), `Imported module missing from APP_SHELL: ${importedPath}`);
}

// Every data path used by the application must be precached as well.
const dataPaths = [...app.matchAll(/["'](\.\/data\/[^"']+\.json)["']/g)].map((match) => match[1]);
for (const dataPath of dataPaths) {
  assert.ok(shellResources.includes(dataPath), `Application data missing from APP_SHELL: ${dataPath}`);
}

assert.equal(fs.existsSync(path.join(root, "assets/icon.svg")), false);
assert.equal(fs.existsSync(path.join(root, "assets/brand/hodie-logo.png")), true);
assert.equal(fs.existsSync(path.join(root, "assets/brand/hodie-logo-dark.png")), true);
assert.equal(fs.existsSync(path.join(root, "assets/icons/icon-light-192.png")), true);
assert.equal(fs.existsSync(path.join(root, "assets/icons/icon-light-512.png")), true);

console.log("HODIE PWA contract: PASS");
