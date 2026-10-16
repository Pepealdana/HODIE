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
assert.ok(validation.vocabularyCount >= 25);
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

// Every tested data matcher must have a positive regression case, and its documented
// negative cases must not trigger that same rule.
for (const rule of catalog.grammarRules.filter((item) => item.status === "tested" && item.matcher)) {
  assert.ok(cases.some((item) => item.expectRules.includes(rule.id)), rule.id + " needs a positive regression case");
  for (const negativeCase of rule.negativeCases || []) {
    const negativeText = typeof negativeCase === "string" ? negativeCase : negativeCase.text;
    assert.ok(typeof negativeText === "string" && negativeText.length > 0, rule.id + " has an invalid negative case");
    const negativeResult = analyzeLanguage(negativeText);
    assert.ok(!negativeResult.errors.some((error) => error.ruleId === rule.id), rule.id + " falsely matched negative case: " + negativeText);
  }
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

const malformedWorkplacePhrase = analyzeLanguage("I work as at school.");
assert.equal(malformedWorkplacePhrase.correctedText, "I work at a school.", "remove the invalid as at sequence in a clear workplace statement");
assert.ok(malformedWorkplacePhrase.errors.some((error) => error.ruleId === "WORK-PLACE-001"));
const validJobAndWorkplace = analyzeLanguage("I work as a teacher at a school.");
assert.equal(validJobAndWorkplace.correctedText, "I work as a teacher at a school.", "preserve valid work as + job + at + workplace phrasing");
assert.equal(validJobAndWorkplace.errors.length, 0);

const validAlternatives = analyzeLanguage("I like to teach, and I like teaching.");
assert.equal(validAlternatives.errors.length, 0, "valid grammar alternatives must not be flagged");

const punctuation = analyzeLanguage("I am teacher. I enjoy to teach.");
assert.equal(punctuation.correctedText, "I am a teacher. I enjoy teaching.");

const presentContinuousFeel = analyzeLanguage("Good, I am feel good.");
assert.equal(presentContinuousFeel.correctedText, "Good, I am feeling good.");
assert.ok(presentContinuousFeel.errors.some((error) => error.ruleId === "PRES-CONT-FEEL-001"));
assert.equal(presentContinuousFeel.errors.find((error) => error.ruleId === "PRES-CONT-FEEL-001").naturalAlternatives[0].en, "Good, I'm doing well.");

for (const [input, expected] of [
  ["I am play football now.", "I am playing football now."],
  ["They are sleep now.", "They are sleeping now."],
  ["She is open the window.", "She is opening the window."],
  ["I am feel good.", "I am feeling good."],
  ["He is run now.", "He is running now."],
  ["They are sit here.", "They are sitting here."]
]) {
  assert.equal(analyzeLanguage(input).correctedText, expected, input);
}
for (const valid of ["I feel good.", "I am feeling good.", "I am ready.", "I am open to new ideas.", "I am clean.", "I know the answer.", "I like this song.", "I am happy."]) {
  assert.equal(analyzeLanguage(valid).errors.length, 0, valid + " must remain valid");
}

const validDoesQuestion = analyzeLanguage("Does she work here?");
assert.equal(validDoesQuestion.correctedText, "Does she work here.");
assert.equal(validDoesQuestion.errors.some((error) => error.ruleId === "DOES-BASE-001"), false);

const invalidDoesQuestion = analyzeLanguage("Does she works here?");
assert.equal(invalidDoesQuestion.correctedText, "Does she work here?");
assert.ok(invalidDoesQuestion.errors.some((error) => error.ruleId === "DOES-BASE-001"));

const knownA2Negation = analyzeLanguage("She doesn't works on Sundays.");
assert.equal(knownA2Negation.correctedText, "She doesn't work on Sundays.");
assert.ok(knownA2Negation.errors.some((error) => error.ruleId === "DO-NEG-BASE-001"));
const validA2Negation = analyzeLanguage("She doesn't work on Sundays.");
assert.equal(validA2Negation.correctedText, "She doesn't work on Sundays.");
assert.equal(validA2Negation.errors.length, 0);
const knownPastNegation = analyzeLanguage("I didn't went to school yesterday.");
assert.equal(knownPastNegation.correctedText, "I didn't go to school yesterday.");
assert.ok(knownPastNegation.errors.some((error) => error.ruleId === "DID-NEG-BASE-001"));
const validPastNegation = analyzeLanguage("I didn't go to school yesterday.");
assert.equal(validPastNegation.errors.length, 0);
const knownModalError = analyzeLanguage("I can to build a robot.");
assert.equal(knownModalError.correctedText, "I can build a robot.");
assert.ok(knownModalError.errors.some((error) => error.ruleId === "MODAL-TO-BASE-001"));
assert.equal(analyzeLanguage("I want to build a robot.").errors.length, 0, "do not confuse want to with a modal pattern");
assert.equal(analyzeLanguage("I have to work today.").errors.length, 0, "do not confuse have to with a modal pattern");

const unverifiedPhrase = analyzeLanguage("I enjoy boarding robotics project.");
assert.equal(unverifiedPhrase.correctedText, "I enjoy boarding robotics project.", "do not guess whether speech recognition meant building");
assert.equal(unverifiedPhrase.evaluationStatus, "no-issue-detected");
assert.equal(unverifiedPhrase.evaluationScope, "partial-deterministic-rule-based");
assert.match(unverifiedPhrase.evaluationNote, /not a complete grammar check/i);
const validOpenPhrase = analyzeLanguage("I enjoy building robotics projects.");
assert.equal(validOpenPhrase.errors.length, 0);
assert.equal(validOpenPhrase.evaluationStatus, "no-issue-detected");
const emptyAnalysis = analyzeLanguage("   ");
assert.equal(emptyAnalysis.evaluationStatus, "not-evaluated");

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
