import assert from "node:assert/strict";
import fs from "node:fs";
import { getStatus, registerEvidence, selectNextCanDo } from "../src/learning-engine.js";

const matrix = JSON.parse(fs.readFileSync(new URL("../data/can-do-matrix.json", import.meta.url), "utf8"));
const progressModel = JSON.parse(fs.readFileSync(new URL("../data/progress-model.json", import.meta.url), "utf8"));

assert.equal(matrix.canDos.length, 133);
assert.equal(Object.values(progressModel.scoring.communicativeWeights).reduce((sum, value) => sum + value, 0), 1);

const ids = new Set(matrix.canDos.map((item) => item.id));
for (const canDo of matrix.canDos) {
  for (const field of ["prerequisites", "recovery"]) {
    for (const id of canDo[field] || []) assert.equal(ids.has(id), true, "Unknown " + field + " reference: " + id);
  }
  assert.ok(canDo.evidence, "Missing evidence: " + canDo.id);
  assert.ok(canDo.mastery, "Missing mastery: " + canDo.id);
  assert.ok(canDo.feedback, "Missing feedback: " + canDo.id);
}

const miniMatrix = {
  canDos: [
    { id:"SP-A2-01", skill:"speaking", level:"A2", priority:"high", canDo:"I can introduce myself.", prerequisites:[], recovery:[], evidence:{type:"speaking",task:"Introduce yourself."}, feedback:{languages:["en","es"],requireRetryForPriorityErrors:true} },
    { id:"SP-A2-02", skill:"speaking", level:"A2", priority:"critical", canDo:"I can talk about my family.", prerequisites:["SP-A2-01"], recovery:["SP-A2-01"], evidence:{type:"speaking",task:"Talk about your family."}, feedback:{languages:["en","es"],requireRetryForPriorityErrors:true} },
    { id:"GR-A2-01", skill:"grammar", level:"A2", priority:"high", canDo:"I can use be correctly.", prerequisites:[], recovery:[], languageResources:{grammar:["be"]}, evidence:{type:"grammar",task:"Use be in a short introduction."}, feedback:{languages:["en","es"],requireRetryForPriorityErrors:true} }
  ]
};

let profile = { evidence: [], reviews: [] };
assert.equal(getStatus(miniMatrix.canDos[0], profile), "notStarted");

const first = registerEvidence(miniMatrix, profile, {canDoId:"SP-A2-01",independent:true,contextId:"intro-1",confidence:4,dimensions:{taskCompletion:.9,grammar:.8,fluency:.8,vocabulary:.8,pronunciation:.8}});
profile = first.profile;
assert.equal(first.canDo.status, "functional");
assert.equal(first.canDo.evidenceLevel, "independent");

const lowConfidence = registerEvidence(miniMatrix, first.profile, {
  canDoId:"SP-A2-01",
  independent:true,
  contextId:"work-2",
  confidence:3,
  dimensions:{taskCompletion:.9,grammar:.8,fluency:.8,vocabulary:.8,pronunciation:.8}
});
assert.equal(lowConfidence.canDo.status, "functional");
assert.equal(lowConfidence.canDo.evidenceLevel, "consistent");

const second = registerEvidence(miniMatrix, profile, {canDoId:"SP-A2-01",independent:true,contextId:"work-1",confidence:4,dimensions:{taskCompletion:.9,grammar:.8,fluency:.8,vocabulary:.8,pronunciation:.8}});
profile = second.profile;
assert.equal(second.canDo.evidenceLevel, "consistent");
assert.equal(second.canDo.status, "consolidated");

const next = selectNextCanDo(miniMatrix, profile);
assert.equal(next.id, "SP-A2-02");

const failed = registerEvidence(miniMatrix, profile, {canDoId:"SP-A2-02",independent:false,contextId:"family-1",confidence:2,dimensions:{taskCompletion:.5,fluency:.4},errors:[{priority:"high",type:"grammar",target:"be",message:"Needs support with be."}]});
assert.equal(failed.gap.type, "grammar");
assert.equal(failed.retryRequired, true);
assert.deepEqual(failed.recovery, ["GR-A2-01"]);

console.log("HODIE Learning Engine integration tests: PASS");
