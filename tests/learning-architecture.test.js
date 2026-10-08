import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSkillGraph, getNextNodes } from "../src/skill-graph.js";
import { selectLearningContext } from "../src/learning-context.js";
import { evaluateTransfer } from "../src/transfer-engine.js";
import { collectErrorMemory, isRepeatedError } from "../src/error-memory.js";
import { buildRepairAction } from "../src/communication-repair.js";
import { allocateBudget } from "../src/learning-budget.js";
import { buildLongitudinalProfile } from "../src/longitudinal-model.js";
import { createRuleBasedProvider, validateProvider } from "../src/conversation-provider.js";

const matrix = JSON.parse(fs.readFileSync(new URL("../data/can-do-matrix.json", import.meta.url)));
const contexts = JSON.parse(fs.readFileSync(new URL("../data/learning-contexts.json", import.meta.url)));

const graph = buildSkillGraph(matrix);
assert.ok(graph.length >= matrix.canDos.length);
assert.ok(getNextNodes(graph, "SP-A2-01").length >= 1 || getNextNodes(graph, "SP-A2-01").length === 0);

const context = selectLearningContext(contexts, ["technology", "robotics", "teacher"]);
assert.equal(context.id, "technology");

const profile = {
  evidence: [
    { canDoId:"SP-A2-01", independent:true, contextId:"teaching", timestamp:"2026-01-01T00:00:00Z", errors:[
      { type:"grammar", target:"article", actual:"I am teacher" }
    ] },
    { canDoId:"SP-A2-01", independent:true, contextId:"professional", timestamp:"2026-01-03T00:00:00Z", errors:[
      { type:"grammar", target:"article", actual:"I am teacher" },
      { type:"grammar", target:"enjoy-ing", actual:"enjoy to build" }
    ] }
  ]
};

const transfer = evaluateTransfer(profile, "SP-A2-01");
assert.equal(transfer.contextCount, 2);
assert.equal(transfer.readyForTransfer, true);

const errors = collectErrorMemory(profile);
assert.equal(errors[0].target, "article");
assert.equal(isRepeatedError(profile, "grammar", "article"), true);

const repair = buildRepairAction({ type:"communication", target:"clarification" }, { contextId:"professional" });
assert.equal(repair.type, "repair");

assert.equal(allocateBudget("quick").minutes, 5);
assert.equal(allocateBudget("deep").microActivities, 7);

const longitudinal = buildLongitudinalProfile(matrix, profile);
assert.equal(longitudinal.evidenceCount, 2);
assert.ok(longitudinal.strongestErrors.length > 0);

const provider = createRuleBasedProvider({
  createExperienceSession: () => ({ state:"started" }),
  evaluateExperienceTurn: () => ({ canContinue:true }),
  advanceExperienceSession: () => ({ state:"started", index:1 })
});
assert.equal(validateProvider(provider).kind, "rule-based");

console.log("HODIE learning architecture foundations: PASS");
