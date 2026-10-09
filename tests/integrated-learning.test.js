import assert from "node:assert/strict";
import fs from "node:fs";
import { buildKnowledgeGraph, getKnowledgeForActivity, validateKnowledgeGraph } from "../src/knowledge-graph.js";
import { recordLearningEvent, recordKnowledgeOutcome, summarizeLearningProfile, recommendBalancedMode } from "../src/learning-profile.js";
import { chooseLearningSurface } from "../src/learning-orchestrator.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const matrix = read("../data/can-do-matrix.json");
const micro = read("../data/micro-practice-library.json");
const content = read("../data/content-library.json");
const knowledge = read("../data/knowledge-library.json");
const graph = buildKnowledgeGraph(matrix, micro, content, knowledge);

assert.equal(graph.valid, true, graph.errors.join("\n"));
assert.equal(validateKnowledgeGraph(graph).valid, true, validateKnowledgeGraph(graph).errors.join("\n"));
assert.equal(graph.nodes.length, knowledge.knowledge.length);
assert.ok(graph.nodes.every((node) => node.canDos.length === node.canDoIds.length));
assert.ok(graph.nodes.some((node) => node.microActivityIds.length > 0), "Knowledge must connect to micro-practice activities.");
assert.ok(graph.nodes.some((node) => node.contentActivityIds.length > 0), "Knowledge must connect to content activities.");
const vocabulary = graph.nodes.find((node) => node.id === "VOC-TECH-01");
assert.ok(vocabulary);
assert.ok(vocabulary.microActivityIds.length > 0);
const activity = micro.activities.find((item) => item.canDoId === "SP-A2-03" && item.resources?.includes("vocabulary"));
assert.ok(getKnowledgeForActivity(graph, activity).length > 0);

let profile = { evidence: [], reviews: [] };
profile = recordLearningEvent(profile, { mode: "writing", canDoId: "SP-A2-01", knowledgeIds: ["FUNC-INTRODUCE-01"] });
profile = recordLearningEvent(profile, { mode: "writing", canDoId: "SP-A2-01", knowledgeIds: ["FUNC-INTRODUCE-01"] });
profile = recordLearningEvent(profile, { mode: "writing", canDoId: "SP-A2-01", knowledgeIds: ["FUNC-INTRODUCE-01"] });
profile = recordLearningEvent(profile, { mode: "writing", canDoId: "SP-A2-01", knowledgeIds: ["FUNC-INTRODUCE-01"] });
profile = recordKnowledgeOutcome(profile, { activityId: "MIC-TEST", mode: "writing", canDoId: "SP-A2-01", knowledgeIds: ["FUNC-INTRODUCE-01"], correct: false, score: 0.4, errors: [{ type: "grammar" }] });
profile = recordKnowledgeOutcome(profile, { activityId: "MIC-TEST-2", mode: "writing", canDoId: "SP-A2-01", knowledgeIds: ["FUNC-INTRODUCE-01"], correct: true, score: 1, errors: [] });
const summary = summarizeLearningProfile(profile);
assert.equal(summary.totalActivities, 4);
assert.equal(summary.skillCounts.writing, 4);
assert.equal(summary.resourceCounts["FUNC-INTRODUCE-01"], 4);
assert.equal(summary.knowledgePerformance["FUNC-INTRODUCE-01"].attempts, 2);
assert.equal(summary.knowledgePerformance["FUNC-INTRODUCE-01"].correct, 1);
assert.equal(summary.knowledgePerformance["FUNC-INTRODUCE-01"].errors, 1);
const balanced = recommendBalancedMode(profile, ["mixed", "speaking", "listening", "writing", "grammar", "vocabulary"]);
assert.ok(balanced);
assert.notEqual(balanced, "writing");

const experiences = read("../data/experience-library.json");
const recommendation = chooseLearningSurface(matrix, experiences, profile, {
  level: "A2",
  context: "professional",
  now: "2026-10-08T00:00:00.000Z",
  knowledgeGraph: graph,
  availableModes: ["mixed", "speaking", "listening", "writing", "grammar", "vocabulary"]
});
assert.equal(recommendation.surface, "practice");
assert.notEqual(recommendation.mode, "writing");
assert.ok(recommendation.reason.includes("several times in a row"));

console.log("HODIE Integrated Learning Architecture: PASS");
