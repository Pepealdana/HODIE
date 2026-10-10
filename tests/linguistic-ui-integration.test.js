import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(app, /import \{ analyzeLanguage \} from "\.\/src\/linguistic-engine\.js"/);
assert.match(app, /function applyLinguisticReview\(response, result = \{\}, skill = "writing"\)/);
assert.match(app, /applyLinguisticReview\(response, evaluated, "speaking"\)/);
assert.match(app, /applyLinguisticReview\(response, evaluated, activity\.skill\)/);
assert.match(app, /maxCorrections: 1/);
assert.match(app, /Rule-based review covers only implemented patterns/);
assert.match(worker, /hodie-shell-v26/);
assert.match(index, /type="module" src="\.\/app\.js"/);

console.log("HODIE linguistic UI integration contract: PASS");
