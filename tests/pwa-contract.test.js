import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const worker = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

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
assert.match(worker, /hodie-shell-v5/);
assert.match(worker, /assets\/brand\/hodie-logo\.png/);
assert.match(worker, /assets\/brand\/hodie-logo-dark\.png/);
assert.match(worker, /assets\/icons\/icon-light-512\.png/);
assert.match(worker, /src\/learning-engine\.js/);
assert.match(worker, /src\/session-runner\.js/);
assert.doesNotMatch(worker, /assets\/icon\.svg/);
assert.doesNotMatch(index, /assets\/icon\.svg/);
assert.doesNotMatch(JSON.stringify(manifest), /assets\/icon\.svg/);

assert.equal(fs.existsSync(new URL("../assets/icon.svg", import.meta.url)), false);
assert.equal(fs.existsSync(new URL("../assets/brand/hodie-logo.png", import.meta.url)), true);
assert.equal(fs.existsSync(new URL("../assets/brand/hodie-logo-dark.png", import.meta.url)), true);
assert.equal(fs.existsSync(new URL("../assets/icons/icon-light-192.png", import.meta.url)), true);
assert.equal(fs.existsSync(new URL("../assets/icons/icon-light-512.png", import.meta.url)), true);

console.log("HODIE PWA contract: PASS");
