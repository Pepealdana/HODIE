import assert from "node:assert/strict";
import { analyzeLanguage, validateLinguisticCatalog, linguisticCatalog } from "../src/linguistic-engine.js";
import { buildKnowledgeGraph, getLinguisticResourcesForCanDo } from "../src/knowledge-graph.js";
import { collectErrorMemory } from "../src/error-memory.js";
import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/linguistic-catalog.json", import.meta.url), "utf8"));
const validation = validateLinguisticCatalog(catalog);
assert.equal(validation.valid, true, validation.errors.join("\n"));
assert.ok(validation.ruleCount >= 25);
assert.ok(validation.testedRuleCount >= 10);
assert.ok(validation.draftRuleCount >= 10);
assert.ok(validation.communicativeFunctionCount >= 10);
assert.ok(catalog.communicativeFunctions.some((item) => item.skills.includes("speaking") && item.skills.includes("writing")));
assert.ok(catalog.grammarRules.every((rule) => rule.explanation && rule.explanationEs && rule.examples && rule.incorrect));

const cases = catalog.testCases;
for (const item of cases) {
  const result = analyzeLanguage(item.text);
  const found = result.errors.map((error) => error.ruleId);
  for (const expectedRule of item.expectRules) {
    assert.ok(found.includes(expectedRule), item.id + ": expected " + expectedRule + ", found " + found.join(", "));
  }
  assert.equal(result.correctedText, item.expectCorrection, item.id + ": corrected text mismatch");
}

const teacher = analyzeLanguage("i am techer");
assert.equal(teacher.correctedText, "I am a teacher");
assert.ok(teacher.errors.some((error) => error.ruleId === "CAP-I-001"));
assert.ok(teacher.errors.some((error) => error.ruleId === "SPELL-TEACHER-001"));
assert.ok(teacher.errors.some((error) => error.ruleId === "ART-JOB-001"));

const plural = analyzeLanguage("The students builds a robot.");
assert.equal(plural.correctedText, "The students build a robot.");
assert.ok(plural.errors.some((error) => error.ruleId === "SVA-PLURAL-001"));

const unknownButValid = analyzeLanguage("I work with Arduino.");
assert.equal(unknownButValid.correctedText, "I work with Arduino.");
assert.equal(unknownButValid.errors.length, 0, "an unfamiliar proper noun must not be treated as an error");

const extensibleVocabulary = analyzeLanguage("I am geologist.", {
  vocabulary: [{ id: "VOC-JOB-GEOLOGIST", lemma: "geologist", partOfSpeech: "job", domain: "jobs", forms: ["geologist", "geologists"] }]
});
assert.equal(extensibleVocabulary.correctedText, "I am a geologist.", "new job vocabulary should reuse grammar rules without editing the engine");

const ambiguousWorkPhrase = analyzeLanguage("I work on a school.");
assert.equal(ambiguousWorkPhrase.correctedText, "I work on a school.", "context-dependent prepositions must not be rewritten without enough context");
assert.equal(ambiguousWorkPhrase.errors.length, 0);

const validAlternatives = analyzeLanguage("I like to teach, and I like teaching.");
assert.equal(validAlternatives.errors.length, 0, "valid grammar alternatives must not be flagged");

const punctuation = analyzeLanguage("I am teacher. I enjoy to teach.");
assert.equal(punctuation.correctedText, "I am a teacher. I enjoy teaching.");

const matrix = JSON.parse(fs.readFileSync(new URL("../data/can-do-matrix.json", import.meta.url), "utf8"));
const knowledge = JSON.parse(fs.readFileSync(new URL("../data/knowledge-library.json", import.meta.url), "utf8"));
const micro = JSON.parse(fs.readFileSync(new URL("../data/micro-practice-library.json", import.meta.url), "utf8"));
const contentLibrary = JSON.parse(fs.readFileSync(new URL("../data/content-library.json", import.meta.url), "utf8"));
const graph = buildKnowledgeGraph(matrix, micro, contentLibrary, knowledge, catalog);
assert.equal(graph.valid, true, graph.errors.join("\\n"));
assert.equal(graph.linguisticCatalogVersion, catalog.schemaVersion);
const linked = getLinguisticResourcesForCanDo(graph, "SP-A2-01");
assert.ok(linked.functions.some((fn) => fn.id === "INTRODUCE_SELF"));
assert.ok(linked.rules.some((rule) => rule.id === "ART-JOB-001"));
assert.ok(linked.vocabulary.some((entry) => entry.lemma === "teacher"));
assert.ok(linked.functions[0].skills.includes("speaking") && linked.functions[0].skills.includes("writing"));

const plannedPastRule = catalog.grammarRules.find((rule) => rule.id === "GRAM-PAST-001");
assert.equal(plannedPastRule.status, "draft");
assert.equal(analyzeLanguage("Yesterday I teach a class.").correctedText, "Yesterday I teach a class.", "unimplemented draft rules must not silently correct learner text");

const memory = collectErrorMemory({ knowledgeEvidence: [
  { at: "2026-10-01T00:00:00Z", surface: "writing", errors: [{ type: "grammar", target: "article-profession", ruleId: "ART-JOB-001", actual: "I am teacher", expected: "I am a teacher" }] },
  { at: "2026-10-02T00:00:00Z", surface: "conversation", errors: [{ type: "grammar", target: "article-profession", ruleId: "ART-JOB-001", actual: "I am teacher", expected: "I am a teacher" }] }
] });
assert.equal(memory[0].target, "ART-JOB-001", "error memory should group by stable rule id across practice surfaces");
assert.equal(memory[0].count, 2);

assert.equal(linguisticCatalog.schemaVersion, catalog.schemaVersion);
console.log("HODIE linguistic catalog and open-vocabulary engine: PASS");
