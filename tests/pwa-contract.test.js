import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const worker = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

assert.match(index, /manifest\.webmanifest/);
assert.match(index, /theme-color/);
assert.equal(manifest.name, "HODIE — Today. Not tomorrow.");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.scope, "./");
assert.ok(manifest.icons?.length);
assert.match(worker, /skipWaiting/);
assert.match(worker, /clients\.claim/);
assert.match(worker, /hodie-shell-v2/);
assert.match(worker, /src\/learning-engine\.js/);
assert.match(worker, /src\/session-runner\.js/);

console.log("HODIE PWA contract: PASS");
