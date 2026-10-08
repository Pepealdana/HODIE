import assert from "node:assert/strict";
import fs from "node:fs";
import { selectMicroActivities } from "../src/micro-practice.js";

const taxonomy = JSON.parse(fs.readFileSync(new URL("../data/practice-taxonomy.json", import.meta.url), "utf8"));
const library = JSON.parse(fs.readFileSync(new URL("../data/micro-practice-library.json", import.meta.url), "utf8"));

assert.equal(taxonomy.schemaVersion, "2.0.0");
assert.equal(taxonomy.layers.modes.mixed.role, "practice-mode");
assert.equal(taxonomy.layers.modes.review.role, "practice-mode");

const mixed = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "mixed", limit: 6 });
assert.equal(mixed.at(-1).type, "mini-production");
assert.ok(mixed.some((item) => item.primarySkill === "speaking"));
assert.ok(mixed.some((item) => item.primarySkill === "listening"));
assert.ok(mixed.some((item) => item.resources?.includes("grammar")));
assert.ok(mixed.some((item) => item.resources?.includes("vocabulary")));

const grammar = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "grammar", limit: 4 });
assert.ok(grammar.slice(0, -1).every((item) => item.resources?.includes("grammar")));

const speaking = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "speaking", limit: 6 });
assert.ok(speaking.some((item) => item.type === "speak"));
assert.equal(speaking.at(-1).type, "mini-production");

const review = selectMicroActivities(library, {
  canDoId: "SP-A2-01",
  mode: "review",
  limit: 4,
  profile: {
    evidence: [{
      canDoId: "SP-A2-01",
      errors: [{ type: "grammar", target: "work-at", priority: "high" }],
      dimensions: { grammar: 0.4 }
    }],
    reviews: []
  }
});
assert.equal(review[0].id, "MIC-SP-A2-01-02");

console.log("HODIE Practice Taxonomy v2: PASS");
