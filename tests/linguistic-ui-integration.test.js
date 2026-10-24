import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const microEngine = fs.readFileSync(new URL("../src/micro-practice.js", import.meta.url), "utf8");
const microLibrary = JSON.parse(fs.readFileSync(new URL("../data/micro-practice-library.json", import.meta.url), "utf8"));

assert.match(app, /import \{ analyzeLanguage \} from "\.\/src\/linguistic-engine\.js"/);
assert.match(app, /linguisticLinks: getLinguisticResourcesForActivity\(activity\)/);
assert.match(app, /correctionIndependentOfActivity: true/);
assert.match(app, /knowledgeAvailability: "global"/);
assert.match(app, /function applyLinguisticReview\(response, result = \{\}, skill = "writing"\)/);
assert.match(app, /applyLinguisticReview\(response, evaluated, "speaking"\)/);
assert.match(app, /applyLinguisticReview\(response, linkedEvaluation, activity\.skill\)/);
assert.match(app, /maxCorrections: 1/);
assert.match(app, /searchLinguisticKnowledge\(text/);
assert.match(app, /createLearningOpportunity/);
assert.match(app, /recordLearningOpportunity/);
assert.match(app, /Learning opportunity · Oportunidad de aprendizaje/);
assert.match(app, /learningOpportunitySummary/);
assert.match(app, /nextTheme === "dark" \? "#101827" : "#F4F6F8"/);
assert.match(app, /Not fully checked · Revisión parcial/);
assert.match(app, /Review transcript · Revisar transcripción/);
assert.match(app, /Related learning tip · Recurso relacionado/);
assert.match(app, /No known rule matched this response/);
assert.match(worker, /hodie-shell-v37/);
assert.match(app, /function applyConversationFirstHome\(level, targetActivity, statement\)/);
assert.match(app, /id="conversationComposer"/);
assert.match(app, /data-home-level/);
assert.match(app, /data-home-skill/);
assert.match(app, /details\.id = "activityCatalogDisclosure"/);
assert.match(app, /experienceSession\.starterPrompt/);
assert.match(app, /function renderLiveWritingCoach\(experience, stage, response\)/);
assert.match(app, /liveWritingCoach/);
assert.match(app, /conversation-writing-guide/);
assert.match(app, /Estructura en español/);
assert.match(app, /What to add · Qué hace falta/);
assert.match(index, /type="module" src="\.\/app\.js"/);


assert.ok(app.includes('["reading", "Reading", "Leer", "▤"]'));
assert.ok(app.includes('["pronunciation", "Pronunciation", "Pronunciación", "◖"]'));
assert.ok(app.includes('["communication", "Communication", "Comunicación", "↔"]'));
assert.ok(app.includes("selectedActivities = selectMicroActivities(microLibrary, options)"));
assert.ok(microEngine.includes('communication: { label: "Communication", kind: "skill", skill: "communication" }'));
for (const id of ["MIC-RE-A2-90-01", "MIC-RE-A2-90-02", "MIC-PR-A2-90-01", "MIC-PR-A2-90-02", "MIC-CO-A2-90-01", "MIC-CO-A2-90-02"]) {
  assert.ok(microLibrary.activities.some((activity) => activity.id === id), `Missing focused practice activity: ${id}`);
}

console.log("HODIE linguistic UI integration contract: PASS");

assert.ok(app.includes("reportedSpeechShortcut"));
assert.ok(app.includes("renderMemoryChallenge"));
assert.ok(app.includes("startTimedChallenge"));
assert.ok(app.includes("reported speech"));

assert.ok(app.includes('home.querySelector("#activityCatalog")'));

assert.ok(app.includes("catalogSection?.scrollIntoView"));
