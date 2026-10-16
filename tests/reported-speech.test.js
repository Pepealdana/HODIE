import assert from "node:assert/strict";
import fs from "node:fs";
import catalog from "../data/linguistic-catalog.json" with { type: "json" };

const matrix = JSON.parse(fs.readFileSync(new URL("../data/can-do-matrix.json", import.meta.url), "utf8"));
const full = JSON.parse(fs.readFileSync(new URL("../data/content-library.json", import.meta.url), "utf8")).activities;
const micro = JSON.parse(fs.readFileSync(new URL("../data/micro-practice-library.json", import.meta.url), "utf8")).activities;
const rule = catalog.grammarRules.find((item) => item.id === "GRAM-REPORTED-SPEECH-001");
assert.ok(rule);
assert.equal(rule.status, "draft", "broad reported-speech rewriting stays non-executable until narrow patterns are tested");
assert.ok(rule.exceptions.length >= 4);
assert.ok(rule.negativeCases.length >= 3);
assert.ok(rule.examplesBilingual.some((item) => item.en && item.es));

for (const level of ["A1", "A2", "B1", "B2"]) {
  for (const skill of ["grammar", "listening", "reading", "writing", "speaking", "communication"]) {
    const canDoId = `RS-${level}-${({grammar:"GR",listening:"LI",reading:"RE",writing:"WR",speaking:"SP",communication:"CO"})[skill]}-01`;
    assert.ok(matrix.canDos.some((item) => item.id === canDoId && item.level === level && item.skill === skill), canDoId);
    assert.ok(full.some((item) => item.canDoId === canDoId && item.level === level && item.skill === skill), `Missing complete activity ${level}/${skill}`);
    const items = micro.filter((item) => item.canDoId === canDoId && item.level === level && item.skill === skill && item.tags?.includes("reported-speech"));
    assert.ok(items.length >= 4, `Need four microactivities for ${level}/${skill}; found ${items.length}`);
    assert.ok(items.every((item) => item.prompt && item.promptEs && item.feedback?.correct && item.feedback?.correctEs));
  }
}
const b2 = [...full, ...micro].filter((item) => item.level === "B2" && item.tags?.includes("reported-speech") || item.level === "B2" && item.metadata?.tags?.includes("reported-speech"));
assert.ok(b2.length >= 30, "B2 content should be authored before the learner unlocks it.");
assert.ok(b2.every((item) => item.validation?.status === "validated" && item.validation?.reviewedBy && item.evaluation?.observable === true),
  "B2 content must pass internal QA metadata checks before being made available.");

console.log("HODIE reported speech pathway: PASS", JSON.stringify({ full:full.filter(x=>x.metadata?.tags?.includes("reported-speech")).length, micro:micro.filter(x=>x.tags?.includes("reported-speech")).length }));
