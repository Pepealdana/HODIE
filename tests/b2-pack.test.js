import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const pack = read("../data/b2-learning-pack.json");
const matrix = read("../data/can-do-matrix.json");
const micro = read("../data/micro-practice-library.json").activities;
const full = read("../data/content-library.json").activities;
const experiences = read("../data/experience-library.json").experiences;
const progressModel = read("../data/progress-model.json");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.equal(pack.visibility, "locked-until-b2-readiness");
assert.equal(pack.gateId, "B2-READINESS-V1");
assert.equal(progressModel.b2Unlock.gateId, pack.gateId);
assert.equal(progressModel.b2Unlock.b1CoverageThreshold, 0.75);
assert.equal(progressModel.b2Unlock.coreSkillCoverageThreshold, 0.60);
assert.equal(pack.canDos.length, 8);
assert.equal(pack.activities.length, 32);
assert.equal(pack.fullActivities.length, 8);
assert.ok(pack.experiences.length >= 3);
for (const skill of matrix.skills) {
  assert.equal(pack.activities.filter((x) => x.skill === skill).length, 4, skill + " must have four B2 micro-activities");
  assert.ok(pack.canDos.some((x) => x.skill === skill && x.level === "B2"), skill + " needs a B2 Can-Do");
}
assert.ok(pack.activities.every((x) => x.level === "B2" && x.prompt && x.promptEs && x.cefrAlignment?.framework === "CEFR Companion Volume"));
assert.ok(pack.activities.every((x) => x.validation?.status === "ready-for-editorial-review" && x.validation.reviewedBy === null));
assert.ok(pack.fullActivities.every((x) => x.level === "B2" && x.evaluation?.observable === true));
assert.ok(pack.experiences.every((x) => x.levels.includes("B2") && x.stages.length >= 3));
assert.equal(micro.some((x) => x.level === "B2"), false, "B2 micro-activities must not leak into the active bank");
assert.equal(full.some((x) => x.level === "B2"), false, "B2 full activities must not leak into the active bank");
assert.equal(experiences.some((x) => x.levels.includes("B2")), false, "B2 simulations must remain isolated until unlock");
assert.ok(app.includes("if (readiness.unlocked && !b2PackActive)"));
assert.ok(app.includes('item === "B2" && !b2Unlock.unlocked'));
assert.ok(app.includes('if (level === "B2" && !b2Unlock.unlocked) return'));
console.log("HODIE B2 package isolation and readiness wiring: PASS");
