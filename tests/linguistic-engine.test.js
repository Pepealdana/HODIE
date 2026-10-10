import assert from "node:assert/strict";
import { analyzeLanguage, validateLinguisticCatalog, linguisticCatalog } from "../src/linguistic-engine.js";
import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/linguistic-catalog.json", import.meta.url), "utf8"));
const validation = validateLinguisticCatalog(catalog);
assert.equal(validation.valid, true, validation.errors.join("\n"));
assert.ok(validation.ruleCount >= 12);
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

const validAlternatives = analyzeLanguage("I like to teach, and I like teaching.");
assert.equal(validAlternatives.errors.length, 0, "valid grammar alternatives must not be flagged");

const punctuation = analyzeLanguage("I am teacher. I enjoy to teach.");
assert.equal(punctuation.correctedText, "I am a teacher. I enjoy teaching.");

assert.equal(linguisticCatalog.schemaVersion, catalog.schemaVersion);
console.log("HODIE linguistic catalog and open-vocabulary engine: PASS");
