import assert from "node:assert/strict";
import fs from "node:fs";
import { validateLinguisticCatalog } from "../src/linguistic-engine.js";
import { getCorrectionRuleSet, searchLinguisticKnowledge } from "../src/linguistic-knowledge-index.js";
import { buildKnowledgeGraph, getLinguisticResourcesForCanDo } from "../src/knowledge-graph.js";
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const catalog = read("../data/linguistic-catalog.json");
const pack = read("../data/linguistic-packs/coverage-2026-02.json");
const micro = read("../data/micro-practice-library.json");
const content = read("../data/content-library.json");
const matrix = read("../data/can-do-matrix.json");
const knowledge = read("../data/knowledge-library.json");
const validation = validateLinguisticCatalog(catalog);
assert.equal(validation.valid, true, validation.errors.join("\n"));
assert.ok(catalog.vocabularyEntries.length >= 440, "expanded vocabulary must be present in runtime catalog");
assert.ok(catalog.grammarRules.length >= 110, "draft and tested grammar references must be present");
assert.ok(catalog.communicativeFunctions.length >= 68, "communicative functions should connect language to real tasks");
assert.ok(catalog.testCases.length >= 115, "regression corpus must grow with the content");
assert.ok(micro.activities.length >= 70, "micro-practice should cover multiple modes");
assert.ok(content.activities.length >= 12, "full activity bank should extend beyond speaking");
assert.ok(new Set(micro.activities.map(x=>x.type)).size >= 7);
assert.ok(new Set(content.activities.map(x=>x.activityType)).size >= 9);
const correctionRules = new Set(getCorrectionRuleSet().map(x=>x.id));
for (const id of ["WORD-ORDER-ADVERBS-001","PRON-OBJECT-001","SOME-ANY-001","PRESENT-SIMPLE-CONTINUOUS-001","PRESENT-PERFECT-EXPERIENCE-001","INDIRECT-QUESTIONS-001"]) {
  assert.equal(catalog.grammarRules.find(x=>x.id===id)?.status,"draft",id+" remains reference-only until validated");
  assert.equal(correctionRules.has(id),false,id+" must not auto-correct before validation");
}
const questionSearch = searchLinguisticKnowledge("indirect questions", {limit:20});
assert.ok(questionSearch.some(x=>x.id==="INDIRECT-QUESTIONS-001"),"search should find draft syntax reference");
const sensorSearch = searchLinguisticKnowledge("sensor", {limit:30});
assert.ok(sensorSearch.some(x=>x.id==="VOC-NOUN-SENSOR"),"search should find vocabulary");
const graph = buildKnowledgeGraph(matrix,micro,content,knowledge,catalog);
assert.equal(graph.valid,true,graph.errors.join("\n"));
const linked = getLinguisticResourcesForCanDo(graph,"SP-A2-01");
assert.ok(linked.functions.length >= 1);
assert.ok(linked.vocabulary.some(x=>x.id==="VOC-NOUN-SENSOR" || x.id==="VOC-NOUN-TOOL"),"Can-Do should retrieve vocabulary by domain");
assert.ok(linked.rules.some(x=>x.id==="WORD-ORDER-ADVERBS-001" || x.category==="word-order"),"Can-Do should retrieve related grammar structures");
for (const activity of content.activities) {
  assert.ok(matrix.canDos.some(x=>x.id===activity.canDoId),activity.id+" must link to a real Can-Do");
  assert.ok(activity.reviewTargets?.length,activity.id+" must identify review targets");
}
console.log("HODIE expanded learning suite: PASS",JSON.stringify({
  grammarRules:catalog.grammarRules.length,
  testedRules:catalog.grammarRules.filter(x=>x.status==="tested").length,
  draftRules:catalog.grammarRules.filter(x=>x.status==="draft").length,
  vocabulary:catalog.vocabularyEntries.length,
  communicativeFunctions:catalog.communicativeFunctions.length,
  regressionCases:catalog.testCases.length,
  microActivities:micro.activities.length,
  contentActivities:content.activities.length,
  linkedCanDoResources:linked.functions.length+linked.rules.length+linked.vocabulary.length
}));
