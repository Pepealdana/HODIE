import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync(new URL("../data/ai-provider-contract.json", import.meta.url)));
assert.equal(contract.status, "interface-only");
assert.equal(contract.safetyAndCost.progressMutationByProvider, false);
assert.equal(contract.safetyAndCost.externalCallRequiredForCorePractice, false);
assert.ok(contract.providers.includes("ai"));
assert.ok(contract.providers.includes("rule-based"));

console.log("HODIE AI provider contract: PASS");
