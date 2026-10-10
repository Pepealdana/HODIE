import { createSession } from "./src/learning-session.js";
import { startSession, requestEvidence } from "./src/session-state.js";
import { runSessionEvidenceCycle } from "./src/session-runner.js";
import { getStatus } from "./src/learning-engine.js";
import { selectMicroActivities, evaluateMicroActivity, getModeLabel } from "./src/micro-practice.js";
import { getExperience, selectExperiences, createExperienceSession, evaluateExperienceTurn, advanceExperienceSession, isExperienceComplete, summarizeExperience } from "./src/experience-engine.js";
import { chooseLearningSurface } from "./src/learning-orchestrator.js";
import { buildKnowledgeGraph, getKnowledgeForCanDo } from "./src/knowledge-graph.js";
import { recordLearningEvent, recordKnowledgeOutcome, summarizeLearningProfile } from "./src/learning-profile.js";
import { getIntegratedUnit, createIntegratedUnitState, submitIntegratedStep, advanceIntegratedStep, summarizeIntegratedUnit } from "./src/integrated-unit.js";
import { createFeedbackContract } from "./src/feedback-contract.js";

const DATA = {
  matrix: "./data/can-do-matrix.json",
  library: "./data/content-library.json",
  micro: "./data/micro-practice-library.json",
  experiences: "./data/experience-library.json",
  contexts: "./data/learning-contexts.json",
  knowledge: "./data/knowledge-library.json",
  units: "./data/integrated-units.json"
};

const STORAGE_KEY = "hodie-progress-v1";
const SESSION_KEY = "hodie-session-v1";
const PRACTICE_STATE_KEY = "hodie-practice-v1";
const EXPERIENCE_STATE_KEY = "hodie-experience-v1";
const THEME_KEY = "hodie-theme-v1";
const INTEGRATED_UNIT_STATE_KEY = "hodie-integrated-unit-v1";

const app = document.querySelector("#app");
const levelBadge = document.querySelector("#levelBadge");
const resetButton = document.querySelector("#resetButton");

let matrix;
let library;
let microLibrary;
let profile;
let session;
let practice = null;
let experienceLibrary;
let contextLibrary;
let knowledgeLibrary;
let knowledgeGraph;
let integratedUnitLibrary;
let integratedUnitState = null;
let experienceSession = null;
let deferredInstallPrompt = null;
let activeSpeechRecognition = null;


function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);

  const toggle = document.querySelector("#themeToggle");
  if (toggle) {
    const dark = nextTheme === "dark";
    toggle.textContent = dark ? "☀" : "☾";
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    toggle.setAttribute("aria-pressed", String(dark));
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", "#172033");
}

function setupTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(current);
  document.querySelector("#themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

function setupInstallPrompt() {
  const prompt = document.querySelector("#installPrompt");
  if (!prompt) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    prompt.hidden = false;
    prompt.innerHTML = `
      <div>
        <strong>Install HODIE</strong>
        <span class="spanish">Use it like an app and keep learning from your device.</span>
      </div>
      <button class="primary compact" id="installButton" type="button">Install</button>
    `;
    document.querySelector("#installButton").addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      prompt.hidden = true;
    });
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    prompt.hidden = true;
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" });
    // Ask the browser to check for a newer worker when HODIE is opened.
    await registration.update();
  } catch (error) {
    console.warn("HODIE Service Worker registration failed.", error);
  }
}

async function loadData() {
  const [matrixResponse, libraryResponse, microResponse, experienceResponse, contextResponse, knowledgeResponse, unitsResponse] = await Promise.all([
    fetch(DATA.matrix),
    fetch(DATA.library),
    fetch(DATA.micro),
    fetch(DATA.experiences),
    fetch(DATA.contexts),
    fetch(DATA.knowledge),
    fetch(DATA.units)
  ]);
  if (!matrixResponse.ok || !libraryResponse.ok || !microResponse.ok || !experienceResponse.ok || !contextResponse.ok || !knowledgeResponse.ok || !unitsResponse.ok) {
    throw new Error("Could not load HODIE learning data.");
  }
  matrix = await matrixResponse.json();
  library = await libraryResponse.json();
  microLibrary = await microResponse.json();
  experienceLibrary = await experienceResponse.json();
  contextLibrary = await contextResponse.json();
  knowledgeLibrary = await knowledgeResponse.json();
  integratedUnitLibrary = await unitsResponse.json();
  knowledgeGraph = buildKnowledgeGraph(matrix, microLibrary, library, knowledgeLibrary);
  if (!knowledgeGraph.valid) console.error("HODIE knowledge graph validation failed.", knowledgeGraph.errors);
}

function loadProfile() {
  try {
    profile = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { evidence: [], reviews: [], learningHistory: [] };
    if (!Array.isArray(profile.learningHistory)) profile.learningHistory = [];
  } catch {
    profile = { evidence: [], reviews: [], learningHistory: [] };
  }
}

function saveProfile() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSavedSession() {
  localStorage.removeItem(SESSION_KEY);
}

function savePracticeState() {
  if (!practice || !session?.id) return;
  localStorage.setItem(PRACTICE_STATE_KEY, JSON.stringify({
    sessionId: session.id,
    mode: practice.mode,
    activityIds: practice.activities.map((activity) => activity.id),
    index: practice.index,
    results: practice.results,
    finalAttempts: practice.finalAttempts,
    currentResponse: practice.currentResponse
  }));
}

function loadSavedPracticeState() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRACTICE_STATE_KEY));
    if (!saved?.sessionId || !saved?.mode || !Array.isArray(saved.activityIds)) return null;
    if (!session?.id || saved.sessionId !== session.id) return null;
    return saved;
  } catch {
    return null;
  }
}

function clearSavedPracticeState() {
  localStorage.removeItem(PRACTICE_STATE_KEY);
}

function getSavedPracticeLabel() {
  const saved = loadSavedPracticeState();
  if (!saved) return null;
  return {
    mode: getModeLabel(saved.mode),
    current: Number(saved.index) + 1,
    total: saved.activityIds.length
  };
}

function resumeSavedPractice() {
  const saved = loadSavedPracticeState();
  if (!saved) {
    renderPracticeHome();
    return;
  }

  const activitiesById = new Map(microLibrary.activities.map((activity) => [activity.id, activity]));
  const activities = saved.activityIds.map((id) => activitiesById.get(id)).filter(Boolean);

  if (activities.length !== saved.activityIds.length || !activities.length) {
    clearSavedPracticeState();
    renderPracticeHome();
    return;
  }

  practice = {
    mode: saved.mode,
    activities,
    index: Math.min(Math.max(Number(saved.index) || 0, 0), activities.length - 1),
    results: Array.isArray(saved.results) ? saved.results : [],
    finalAttempts: Number(saved.finalAttempts) || 0,
    currentResponse: saved.currentResponse || null
  };

  renderMicroActivity();
}

function getVerticalProgress() {
  const ids = ["SP-A2-01", "SP-A2-02", "SP-A2-03", "SP-A2-04"];
  const completed = ids.filter((id) => {
    const canDo = matrix.canDos.find((item) => item.id === id);
    return canDo && ["functional", "consolidated", "transferred"].includes(getStatus(canDo, profile));
  });
  return { count: completed.length, total: ids.length };
}

function renderProgress() {
  const { count, total } = getVerticalProgress();
  return `
    <div class="progress-row"><span>Functional Can-Dos</span><strong>${count}/${total}</strong></div>
    <div class="progress-track"><div class="progress-fill" style="width:${(count / total) * 100}%"></div></div>
  `;
}

function renderPracticeHome() {
  const targetActivity = session.stages.find((stage) => stage.kind === "target")?.activity;
  const statement = session.target.statement;
  const spanish = session.target.spanish || "";
  const savedPractice = getSavedPracticeLabel();
  const savedExperience = getSavedExperienceLabel();
  const level = session.target.level;
  const hasEvidence = Array.isArray(profile?.evidence) && profile.evidence.length > 0;

  const adaptiveRecommendation = chooseLearningSurface(matrix, experienceLibrary, profile, {
    level,
    context: "professional",
    contextLibrary,
    contextTerms: ["technology", "teaching", "professional"],
    knowledgeGraph,
    availableModes: ["mixed", "speaking", "listening", "writing", "grammar", "vocabulary"]
  });

  // First-time users should enter through the core practice loop.
  // Once evidence exists, the adaptive orchestrator may recommend another surface.
  const recommended = hasEvidence
    ? adaptiveRecommendation
    : {
        surface: "practice",
        mode: "mixed",
        reason: "Start with a short mixed practice and build from there."
      };

  const conversations = selectExperiences(experienceLibrary, { kind: "conversation", level });
  const simulations = selectExperiences(experienceLibrary, { kind: "simulation", level });

  const primaryModes = [
    ["mixed", "Practice", "Práctica", "▤", "Start with short actions"],
    ["conversation", "Conversation", "Conversación", "●", "Use English in context"],
    ["simulation", "Simulation", "Simulación", "◆", "Practice a real situation"],
    ["review", "Review", "Repaso", "◷", "Reinforce what you need"]
  ];

  const focusModes = [
    ["speaking", "Speaking", "Hablar", "◉"],
    ["listening", "Listening", "Escuchar", "◖"],
    ["writing", "Writing", "Escribir", "✎"],
    ["grammar", "Grammar", "Gramática", "A"],
    ["vocabulary", "Vocabulary", "Vocabulario", "Aa"]
  ];

  const recommendedTitle = recommended.surface === "practice"
    ? recommended.mode === "review" ? "Review what needs reinforcement" : "Start today's practice"
    : recommended.surface === "conversation" ? "Have a conversation"
    : "Try a simulation";

  const recommendedAction = recommended.surface === "practice"
    ? () => startPractice(recommended.mode)
    : () => startExperience(recommended.experienceId);

  app.innerHTML = `
    <section class="card learning-home">
      <div class="home-intro">
        <p class="kicker">Today's practice · ${escapeHtml(level)}</p>
        <h2>${escapeHtml(targetActivity?.title || "Practice English")}</h2>
        <p class="spanish activity-title-es">${escapeHtml(targetActivity?.titleEs || "")}</p>
        <p class="can-do-line">${escapeHtml(statement)}</p>
        <p class="spanish">${escapeHtml(spanish)}</p>
      </div>

      ${savedPractice ? `
        <div class="resume-practice">
          <div>
            <p class="kicker">Continue where you left off</p>
            <strong>${escapeHtml(savedPractice.mode)}</strong>
            <p class="spanish">${savedPractice.current}/${savedPractice.total}</p>
          </div>
          <button class="secondary compact" id="resumePracticeButton" type="button">Continue</button>
        </div>
      ` : ""}

      ${savedExperience ? `
        <div class="resume-experience">
          <div>
            <p class="kicker">Continue conversation</p>
            <strong>${escapeHtml(savedExperience.title)}</strong>
            <p class="spanish">Turn ${savedExperience.current}/${savedExperience.total}</p>
          </div>
          <button class="secondary compact" id="resumeExperienceButton" type="button">Continue</button>
        </div>
      ` : ""}

      <section class="recommended-learning recommended-primary" aria-label="Today's recommended practice">
        <div>
          <p class="kicker">Today's recommended practice</p>
          <h3>${escapeHtml(recommendedTitle)}</h3>
          <p class="spanish">${escapeHtml(recommended.reason)}</p>
        </div>
        <button class="primary" id="recommendedLearningButton" type="button">Start practice <span aria-hidden="true">→</span></button>
      </section>

      <section class="integrated-unit-card" aria-label="Integrated learning unit">
        <p class="kicker">Learn and reuse</p>
        <h3>A robotics project at school</h3>
        <p class="spanish">Aprende vocabulario, lee, observa la gramática, escribe y habla sobre el mismo tema.</p>
        <p>One connected unit · ${getIntegratedUnit(integratedUnitLibrary, "UNIT-A2-ROBOTICS-01")?.steps.length || 0} steps · about 12 minutes</p>
        <button class="primary" id="startIntegratedUnitButton" type="button">Start integrated unit →</button>
      </section>

      <section class="quick-choices" aria-label="Other ways to practice">
        <div class="section-heading">
          <div>
            <p class="choice-title">Choose another way to practice</p>
            <p class="spanish">Pick a different experience when you need it.</p>
          </div>
        </div>
        <div class="category-grid primary-categories">
          ${primaryModes.map(([value, en, es, icon, hint]) => `
            <button class="category-card category-${value}" data-primary-mode="${value}" type="button">
              <span class="category-icon" aria-hidden="true">${icon}</span>
              <span class="category-copy">
                <strong>${en}</strong>
                <span>${es}</span>
                <small>${hint}</small>
              </span>
              <span class="category-arrow" aria-hidden="true">›</span>
            </button>
          `).join("")}
        </div>
      </section>

      <details class="choice-disclosure">
        <summary>Focus on a specific skill or resource</summary>
        <div class="category-grid focus-categories">
          ${focusModes.map(([value, en, es, icon]) => `
            <button class="category-card category-focus-${value}" data-mode="${value}" type="button">
              <span class="category-icon" aria-hidden="true">${icon}</span>
              <span class="category-copy">
                <strong>${en}</strong>
                <span>${es}</span>
              </span>
              <span class="category-arrow" aria-hidden="true">›</span>
            </button>
          `).join("")}
        </div>
      </details>

      <details class="choice-disclosure advanced-choices" id="experienceChoices">
        <summary>Explore conversations and simulations</summary>
        <div class="experience-sections">
          <section class="experience-section">
            <div class="section-heading">
              <div>
                <p class="choice-title">Conversations</p>
                <p class="spanish">Open responses with light structure.</p>
              </div>
            </div>
            <div class="experience-grid">
              ${conversations.map((item) => `
                <button class="experience-card category-conversation" data-experience="${item.id}" type="button">
                  <span class="experience-kind">Conversation</span>
                  <strong>${escapeHtml(item.title)}</strong>
                  <span class="spanish">${escapeHtml(item.titleEs)}</span>
                  <small>${escapeHtml(item.description)}</small>
                </button>
              `).join("")}
            </div>
          </section>

          <section class="experience-section">
            <div class="section-heading">
              <div>
                <p class="choice-title">Simulations</p>
                <p class="spanish">Real situations: interviews, classes and presentations.</p>
              </div>
            </div>
            <div class="experience-grid">
              ${simulations.map((item) => `
                <button class="experience-card category-simulation" data-experience="${item.id}" type="button">
                  <span class="experience-kind">${escapeHtml(item.role || "Simulation")}</span>
                  <strong>${escapeHtml(item.title)}</strong>
                  <span class="spanish">${escapeHtml(item.titleEs)}</span>
                  <small>${escapeHtml(item.description)}</small>
                </button>
              `).join("")}
            </div>
          </section>
        </div>
      </details>

      <aside class="quick-principle" aria-label="HODIE learning principle">
        <strong>Practice, communicate, remember.</strong>
        <span>Use English first. Feedback helps you improve.</span>
      </aside>

      <section class="shared-knowledge-summary" aria-label="Shared learning knowledge">
        <p class="kicker">Connected learning</p>
        <strong>${knowledgeGraph?.nodes.length || 0} knowledge links</strong>
        <p class="spanish">Vocabulary, grammar, communication functions and pronunciation connect to Can-Do goals and practice activities.</p>
        <small>${summarizeLearningProfile(profile).totalActivities} practice starts tracked · ${knowledgeGraph?.valid ? "knowledge links validated" : "knowledge links need review"}</small>
      </section>

      <div class="home-progress">
        ${renderProgress()}
      </div>
    </section>
  `;

  document.querySelector("#recommendedLearningButton").addEventListener("click", recommendedAction);
  document.querySelector("#startIntegratedUnitButton")?.addEventListener("click", startIntegratedUnit);

  document.querySelectorAll("[data-primary-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.primaryMode;
      if (value === "conversation") {
        const item = conversations[0];
        if (item) { startExperience(item.id); }
        else {
          const panel = document.querySelector("#experienceChoices");
          if (panel) panel.open = true;
          document.querySelectorAll(".experience-section")[0]?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
      if (value === "simulation") {
        const item = simulations[0];
        if (item) { startExperience(item.id); }
        else {
          const panel = document.querySelector("#experienceChoices");
          if (panel) panel.open = true;
          document.querySelectorAll(".experience-section")[1]?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
      startPractice(value);
    });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => startPractice(button.dataset.mode));
  });
  document.querySelectorAll("[data-experience]").forEach((button) => {
    button.addEventListener("click", () => startExperience(button.dataset.experience));
  });
  document.querySelector("#resumePracticeButton")?.addEventListener("click", resumeSavedPractice);
  document.querySelector("#resumeExperienceButton")?.addEventListener("click", renderExperience);
}

function startIntegratedUnit() {
  const unit = getIntegratedUnit(integratedUnitLibrary, "UNIT-A2-ROBOTICS-01");
  if (!unit) { renderError(new Error("Integrated unit not found.")); return; }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(INTEGRATED_UNIT_STATE_KEY)); } catch { saved = null; }
  integratedUnitState = createIntegratedUnitState(unit, saved);
  if (integratedUnitState.complete) integratedUnitState = createIntegratedUnitState(unit);
  profile = recordLearningEvent(profile, { mode: "mixed", surface: "integrated-unit", skill: "integrated", canDoId: unit.canDoIds[0], knowledgeIds: unit.knowledgeIds });
  saveProfile();
  saveIntegratedUnitState();
  renderIntegratedUnitStep();
}

function saveIntegratedUnitState() {
  if (integratedUnitState) localStorage.setItem(INTEGRATED_UNIT_STATE_KEY, JSON.stringify({ unitId: integratedUnitState.unitId, index: integratedUnitState.index, results: integratedUnitState.results, responses: integratedUnitState.responses, complete: integratedUnitState.complete }));
}

function renderIntegratedUnitStep() {
  const state = integratedUnitState;
  if (!state?.unit) { renderPracticeHome(); return; }
  if (state.complete) { renderIntegratedUnitComplete(); return; }
  const step = state.unit.steps[state.index];
  const previous = state.lastResult?.stepId === step.id ? state.lastResult : null;
  const choiceStep = step.kind === "choose";
  app.innerHTML = `
    <section class="card integrated-unit-session">
      <button class="secondary compact" id="integratedUnitExitButton" type="button">← Back to learning</button>
      <p class="kicker">Integrated unit · Step ${state.index + 1} of ${state.unit.steps.length}</p>
      <h2>${escapeHtml(step.title)}</h2>
      <p class="spanish">${escapeHtml(step.titleEs)}</p>
      <p>${escapeHtml(step.instruction)}</p>
      <p class="spanish">${escapeHtml(step.instructionEs)}</p>
      ${step.text ? `<div class="reading-passage"><p>${escapeHtml(step.text)}</p><p class="spanish">${escapeHtml(step.textEs || "")}</p></div>` : ""}
      <h3>${escapeHtml(step.prompt)}</h3>
      ${choiceStep ? `<div class="integrated-unit-options">${step.options.map((option) => `<button type="button" class="secondary integrated-option" data-unit-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}</div>` : `<label for="integratedUnitResponse">${step.kind === "speak" ? "Your answer (type or use the microphone)" : "Your answer"}</label><textarea id="integratedUnitResponse" rows="4" placeholder="Write your answer in English...">${escapeHtml(state.responses[step.id] || "")}</textarea>${step.kind === "speak" ? `<button class="secondary compact" id="integratedUnitMicButton" type="button">Use microphone</button>` : ""}`}
      <details class="learning-hint" open><summary>Hint / Ayuda</summary><p>${escapeHtml(step.hint)}</p><p class="spanish">${escapeHtml(step.hintEs || "")}</p></details>
      ${previous ? `<div class="instant-feedback ${previous.correct === null ? "feedback-neutral" : previous.correct ? "feedback-success" : "feedback-retry"}"><strong>${previous.correct === null ? "Response saved · compare with the example" : previous.correct ? "Good work" : "Keep practising"}</strong><p>${escapeHtml(previous.feedback || "")}</p><p class="spanish">${escapeHtml(previous.feedbackEs || "")}</p>${previous.checks?.length ? `<div class="production-checklist"><strong>Self-check · Revisión guiada</strong><ul>${previous.checks.map((check) => `<li>${check.passed ? "✓" : "○"} ${escapeHtml(check.id.replaceAll("-", " "))}${!check.passed ? ` — ${escapeHtml(check.feedback)}` : ""}</li>`).join("")}</ul><p class="spanish">${escapeHtml(previous.evaluationNoteEs || "")}</p></div>` : ""}${step.model ? `<p><strong>Example:</strong> ${escapeHtml(step.model)}</p><p class="spanish">${escapeHtml(step.modelEs || "")}</p>` : ""}</div><button class="primary" id="integratedUnitNextButton" type="button">${state.index + 1 === state.unit.steps.length ? "Finish unit" : "Next step →"}</button>` : `<button class="primary" id="integratedUnitCheckButton" type="button">${choiceStep ? "Check answer" : "Submit answer"}</button>`}
    </section>
  `;
  document.querySelector("#integratedUnitExitButton").addEventListener("click", () => { saveIntegratedUnitState(); renderPracticeHome(); });
  document.querySelectorAll("[data-unit-answer]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-unit-answer]").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    integratedUnitState.responses[step.id] = button.dataset.unitAnswer;
  }));
  document.querySelector("#integratedUnitCheckButton")?.addEventListener("click", () => {
    const response = choiceStep ? integratedUnitState.responses[step.id] : document.querySelector("#integratedUnitResponse")?.value || "";
    if (!String(response || "").trim()) { document.querySelector("#integratedUnitResponse")?.focus(); return; }
    integratedUnitState = submitIntegratedStep(integratedUnitState, response);
    const result = integratedUnitState.lastResult;
    profile = recordKnowledgeOutcome(profile, { activityId: state.unit.id + ":" + step.id, mode: step.skill, skill: step.skill, canDoId: state.unit.canDoIds[0], knowledgeIds: step.knowledgeIds, correct: result.correct, score: result.score, errors: result.correct === false ? [{ type: step.skill, stepId: step.id }] : [], independent: true });
    saveProfile();
    saveIntegratedUnitState();
    renderIntegratedUnitStep();
  });
  document.querySelector("#integratedUnitMicButton")?.addEventListener("click", () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { window.alert("Speech recognition is not available in this browser. Type your answer instead."); return; }
    const recognition = new Recognition(); recognition.lang = "en-US"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = (event) => { const field = document.querySelector("#integratedUnitResponse"); if (field) field.value = event.results[0][0].transcript; };
    recognition.onerror = () => window.alert("Speech recognition stopped. You can type your answer instead.");
    recognition.start();
  });
  document.querySelector("#integratedUnitNextButton")?.addEventListener("click", () => {
    integratedUnitState = advanceIntegratedStep(integratedUnitState);
    delete integratedUnitState.lastResult;
    saveIntegratedUnitState();
    renderIntegratedUnitStep();
  });
}

function renderIntegratedUnitComplete() {
  const summary = summarizeIntegratedUnit(integratedUnitState);
  app.innerHTML = `<section class="card integrated-unit-complete"><p class="kicker">Unit complete</p><h2>${escapeHtml(integratedUnitState.unit.title)}</h2><p class="spanish">${escapeHtml(integratedUnitState.unit.titleEs)}</p><p>You practised ${summary.skills.join(", ")} and reused shared vocabulary and grammar.</p><p class="spanish">Practicaste varias habilidades usando el mismo vocabulario y la misma gramática.</p><p><strong>${summary.completedSteps}/${summary.totalSteps}</strong> steps completed · <strong>${summary.correctSteps}</strong> objective checks passed · <strong>${summary.selfReviewSteps}</strong> production responses to self-review</p><p>Key language: robot · sensor · build · use · students</p><button class="primary" id="integratedUnitHomeButton" type="button">Back to learning</button><button class="secondary" id="integratedUnitRepeatButton" type="button">Repeat unit</button></section>`;
  document.querySelector("#integratedUnitHomeButton").addEventListener("click", renderPracticeHome);
  document.querySelector("#integratedUnitRepeatButton").addEventListener("click", () => { integratedUnitState = createIntegratedUnitState(integratedUnitState.unit); saveIntegratedUnitState(); renderIntegratedUnitStep(); });
}
function saveExperienceState() {
  if (!experienceSession) return;
  localStorage.setItem(EXPERIENCE_STATE_KEY, JSON.stringify(experienceSession));
}

function clearExperienceState() {
  localStorage.removeItem(EXPERIENCE_STATE_KEY);
}

function getSavedExperienceLabel() {
  if (!experienceSession) return null;
  const experience = getExperience(experienceLibrary, experienceSession.experienceId);
  if (!experience || isExperienceComplete(experience, experienceSession)) return null;
  return {
    title: experience.title,
    current: experienceSession.index + 1,
    total: experience.stages.length
  };
}

function startExperience(experienceId) {
  const experience = getExperience(experienceLibrary, experienceId);
  if (!experience) {
    renderError(new Error("Learning experience not found."));
    return;
  }

  profile = recordLearningEvent(profile, {
    mode: experience.kind === "simulation" ? "simulation" : "conversation",
    surface: experience.kind,
    skill: "speaking",
    canDoId: session?.target?.canDoId,
    knowledgeIds: getKnowledgeForCanDo(knowledgeGraph, session?.target?.canDoId).map((node) => node.id)
  });
  saveProfile();
  experienceSession = createExperienceSession(experienceLibrary, experienceId);
  saveExperienceState();
  renderExperience();
}

function renderExperience() {
  const experience = getExperience(experienceLibrary, experienceSession?.experienceId);
  if (!experience || !experienceSession) {
    renderPracticeHome();
    return;
  }

  if (isExperienceComplete(experience, experienceSession)) {
    renderExperienceComplete(experience);
    return;
  }

  const stage = experience.stages[experienceSession.index];
  app.innerHTML = `
    <section class="card experience-session">
      <div class="practice-nav">
        <button class="secondary compact" id="experienceBackButton" type="button">← Back to learning</button>
        <span class="practice-nav-hint">Saved on this device</span>
      </div>

      <div class="experience-topline">
        <span class="kicker">${escapeHtml(experience.kind)} · ${experienceSession.index + 1}/${experience.stages.length}</span>
        <span class="practice-skill">${escapeHtml(experience.role || "HODIE")}</span>
      </div>

      <div class="experience-context">
        <p class="experience-kind">${escapeHtml(experience.title)}</p>
        <h2>${escapeHtml(stage.title)}</h2>
        <p class="spanish">${escapeHtml(stage.titleEs)}</p>
      </div>

      <div class="micro-prompt">
        <p class="prompt-en">${escapeHtml(stage.prompt)}</p>
        <p class="spanish">${escapeHtml(stage.promptEs)}</p>
      </div>

      <details class="learning-hints" open>
        <summary>Need help answering? <span class="spanish">¿Necesitas ayuda?</span></summary>
        <div class="hint-content">
          <p><strong>Sentence starters · Puedes comenzar así</strong></p>
          <div class="hint-chips"><span>I am...</span><span>I work...</span><span>I teach...</span><span>I have...</span><span>I like...</span><span>I would like to...</span></div>
          
          <p><strong>Connect your ideas · Une las ideas</strong></p>
          <div class="hint-chips"><span>and = y</span><span>but = pero</span><span>because = porque</span><span>then = luego</span></div>
          <details class="model-answer"><summary>Show an example · Ver ejemplo</summary><p>I am a technology teacher. I work at a school. I enjoy building robotics projects with students.</p><p class="spanish">Soy profesor de tecnología. Trabajo en un colegio. Disfruto construir proyectos de robótica con estudiantes.</p></details>
        </div>
      </details>
      <div class="conversation-response">
        <div class="actions voice-controls">
          <button class="primary" id="experienceSpeakButton" type="button">🎙 Start speaking</button>
          <button class="secondary compact" id="experienceStopButton" type="button" disabled>Stop recording</button>
        </div>
        <textarea id="experienceResponse" class="production-input" placeholder="You can type or edit your answer here..."></textarea>
        <button class="secondary compact" id="experienceCheckButton" type="button">Send answer</button>
        <p class="spanish experience-note">This is open practice. HODIE checks useful signals and gives feedback; it does not require one exact answer.</p>
      </div>

      <div id="experienceFeedback" aria-live="polite"></div>

      <div class="micro-progress">
        <div class="progress-track"><div class="progress-fill" style="width:${((experienceSession.index) / experience.stages.length) * 100}%"></div></div>
      </div>
    </section>
  `;

  document.querySelector("#experienceBackButton").addEventListener("click", () => {
    saveExperienceState();
    renderPracticeHome();
  });

  const submit = (response) => handleExperienceResponse(experience, stage, response);
  document.querySelector("#experienceCheckButton").addEventListener("click", () => {
    submit(document.querySelector("#experienceResponse").value.trim());
  });
  document.querySelector("#experienceSpeakButton").addEventListener("click", () => {
    startSpeechRecognition(
      { id: `${experience.id}-${stage.id}`, targetPhrase: stage.prompt, context: experience.contexts?.[0] || "general" },
      (transcript) => {
        const input = document.querySelector("#experienceResponse");
        if (input) input.value = transcript;
      }
    );
    const stopButton = document.querySelector("#experienceStopButton");
    if (stopButton) stopButton.disabled = !activeSpeechRecognition;
  });
  document.querySelector("#experienceStopButton")?.addEventListener("click", () => activeSpeechRecognition?.stop());
}

function handleExperienceResponse(experience, stage, response) {
  const result = evaluateExperienceTurn(experience, stage, response);
  const feedbackContract = createFeedbackContract({
    activity: { id: `${experience.id}-${stage.id}`, type: "conversation", skill: "speaking" },
    surface: "conversation",
    skill: "speaking",
    response,
    result,
    source: "rule-based"
  });
  if (feedbackContract.responseProvided) {
    profile = recordKnowledgeOutcome(profile, {
      activityId: `${experience.id}-${stage.id}`,
      mode: "speaking",
      surface: "conversation",
      skill: "speaking",
      correct: null,
      score: result.score,
      errors: result.errors || [],
      independent: true
    });
    saveProfile();
  }
  const feedback = document.querySelector("#experienceFeedback");
  if (!result.canContinue) {
    feedback.innerHTML = `
      <div class="instant-feedback feedback-retry">
        <strong>Try again</strong>
        <p>Please answer in English before continuing.</p>
        <p class="spanish">Escribe o di una respuesta en inglés antes de continuar.</p>
      </div>
    `;
    return;
  }

  const strengths = feedbackContract.strengths;
  const languageNotes = feedbackContract.corrections;
  const missingLabels = feedbackContract.missing.map((item) => item.label || item.id);
  feedback.innerHTML = `
    <section class="instant-feedback feedback-success experience-turn-feedback" aria-labelledby="turnFeedbackTitle">
      <div class="feedback-heading">
        <span class="feedback-status-mark" aria-hidden="true">✓</span>
        <div>
          <h3 id="turnFeedbackTitle">Your feedback · Tu retroalimentación</h3>
          <p>Your answer is saved for this conversation. Review one useful point before continuing.</p>
          <p class="spanish">Tu respuesta quedó registrada. Revisa un punto útil antes de continuar.</p>
        </div>
      </div>
      <div class="feedback-metrics" aria-label="Response signals">
        <div><strong>${feedbackContract.metrics.wordCount}</strong><span>words · palabras</span></div>
        <div><strong>${feedbackContract.metrics.sentenceCount}</strong><span>sentences · oraciones</span></div>
      </div>
      <div class="feedback-section">
        <h4>What went well · Lo que hiciste bien</h4>
        ${strengths.length ? `<ul class="feedback-list">${strengths.map((item) => `<li><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.message)}</p><p class="spanish">${escapeHtml(item.messageEs)}</p></li>`).join("")}</ul>` : `<p>You responded to the prompt. Try adding one detail to make the idea clearer.</p><p class="spanish">Respondiste a la consigna. Intenta añadir un detalle para expresar la idea con más claridad.</p>`}
      </div>
      <div class="feedback-section">
        <h4>One thing to improve · Un aspecto para mejorar</h4>
        ${languageNotes.length ? `
          ${languageNotes.map((error) => `<article class="correction-item"><strong>Suggested form · Forma sugerida</strong>${error.actual ? `<p class="feedback-original">You wrote · Escribiste: <span>${escapeHtml(error.actual)}</span></p>` : ""}<p class="feedback-example">${escapeHtml(error.expected || error.correction || "")}</p><p>${escapeHtml(error.message || "")}</p><p class="spanish">${escapeHtml(error.messageEs || "")}</p>${error.examples?.length ? `<p class="example-label">Examples: ${escapeHtml(error.examples.join(" · "))}</p>` : ""}</article>`).join("")}
        ` : missingLabels.length ? `
          <p>Try to include this idea: <strong>${escapeHtml(missingLabels.join(", "))}</strong>.</p>
          <p class="spanish">Intenta incluir esta idea: <strong>${escapeHtml(missingLabels.join(", "))}</strong>.</p>
        ` : `
          <p>No issue matched HODIE's current grammar rules. This is not a full grammar check; you can still improve your answer with a detail or example.</p>
          <p class="spanish">Ningún problema coincidió con las reglas gramaticales actuales de HODIE. Esto no es una revisión gramatical completa; todavía puedes mejorar tu respuesta con un detalle o ejemplo.</p>
        `}
      </div>
      <div class="feedback-next-step">
        <h4>Try this next · Prueba esto</h4>
        <strong>${escapeHtml(result.nextStep?.title || "Keep practising")}</strong>
        <p>${escapeHtml(result.nextStep?.instruction || "Add one more detail to your answer.")}</p>
        <p class="spanish">${escapeHtml(result.nextStep?.titleEs || "Sigue practicando")}: ${escapeHtml(result.nextStep?.instructionEs || "Añade un detalle más a tu respuesta.")}</p>
      </div>
      <p class="feedback-limit">Feedback source: rule-based. Practice guidance only; it does not assign an official CEFR level.</p>
      <div class="actions">
        <button class="primary compact" id="nextExperienceButton" type="button">${experienceSession.index + 1 >= experience.stages.length ? "View conversation review" : "Next question"}</button>
      </div>
    </section>
  `;

  document.querySelector("#nextExperienceButton").addEventListener("click", () => {
    experienceSession = advanceExperienceSession(experienceSession, result);
    saveExperienceState();
    renderExperience();
  });
}

function renderExperienceComplete(experience) {
  const summary = summarizeExperience(experience, experienceSession);
  app.innerHTML = `
    <section class="card experience-session">
      <p class="kicker">${escapeHtml(experience.kind)} complete</p>
      <h2>${escapeHtml(experience.title)}</h2>
      <p class="spanish">${escapeHtml(experience.titleEs)}</p>

      <div class="notice success">
        <strong>Experience completed</strong>
        <p>${summary.turns}/${summary.totalTurns} turns completed.</p>
        <p class="spanish">Completaste ${summary.turns} de ${summary.totalTurns} intervenciones.</p>
      </div>

      <section class="experience-summary" aria-labelledby="conversationReviewTitle">
        <h3 id="conversationReviewTitle">Conversation review · Resumen de la conversación</h3>
        <p>Use this review to choose what to practise next. These are rule-based signals, not a complete grammar assessment.</p>
        <p class="spanish">Usa este resumen para elegir qué practicar. Son señales basadas en reglas, no una evaluación gramatical completa.</p>
        ${summary.strengths.length ? `
          <div class="feedback-section">
            <h4>Strengths · Fortalezas observadas</h4>
            <ul class="feedback-list">${summary.strengths.slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
        ` : ""}
        ${summary.focusAreas.length ? `
          <div class="feedback-section">
            <h4>Ideas to develop · Ideas por desarrollar</h4>
            <ul class="feedback-list">${summary.focusAreas.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
        ` : ""}
        <div class="feedback-section">
          <h4>Suggested practice · Práctica sugerida</h4>
          ${summary.practiceSteps.map((step) => `
            <article class="correction-item">
              <strong>${step.turn}. ${escapeHtml(step.title)}</strong>
              <p>${escapeHtml(step.instruction)}</p>
              <p class="spanish">${escapeHtml(step.titleEs)}: ${escapeHtml(step.instructionEs)}</p>
            </article>
          `).join("")}
        </div>
        ${summary.corrections.length ? `
          <div class="feedback-section">
            <h4>Language patterns to review · Patrones de inglés para revisar</h4>
            ${summary.corrections.slice(0, 6).map((error) => `
              <article class="correction-item">
                <strong>${escapeHtml(error.expected || error.correction || "")}</strong>
                <p>${escapeHtml(error.message || "")}</p>
                <p class="spanish">${escapeHtml(error.messageEs || "")}</p>
              </article>
            `).join("")}
          </div>
        ` : `
          <p>No rule-based grammar issue was detected in these answers. That does not mean every sentence is error-free; the current offline checker only recognizes selected patterns.</p>
          <p class="spanish">No se detectaron problemas con las reglas gramaticales disponibles. Eso no significa que todas las frases estén libres de errores; el corrector local solo reconoce algunos patrones.</p>
        `}
      </section>

      <p class="spanish">Esta experiencia es práctica comunicativa. Todavía no cambia por sí sola tu nivel: el progreso oficial requiere evidencia dentro del motor de aprendizaje.</p>

      <div class="actions">
        <button class="primary" id="experienceHomeButton" type="button">Back to learning</button>
        <button class="secondary" id="experienceAgainButton" type="button">Try again</button>
      </div>
    </section>
  `;

  document.querySelector("#experienceHomeButton").addEventListener("click", () => {
    clearExperienceState();
    experienceSession = null;
    renderPracticeHome();
  });
  document.querySelector("#experienceAgainButton").addEventListener("click", () => {
    experienceSession = createExperienceSession(experienceLibrary, experience.id);
    saveExperienceState();
    renderExperience();
  });
}

function prepareSessionForPractice() {
  if (session.state === "planned") {
    return requestEvidence(startSession(session));
  }

  if (session.state === "started") {
    return requestEvidence(session);
  }

  if (session.state === "awaiting-evidence") {
    return session;
  }

  if (session.state === "retry-required") {
    return requestEvidence(startSession(session));
  }

  throw new Error(`This session cannot start from state: ${session.state}`);
}

function startPractice(mode) {
  const activities = selectMicroActivities(microLibrary, {
    canDoId: session.target.canDoId,
    mode,
    limit: 6,
    profile
  });

  if (!activities.length) {
    renderError(new Error(`No micro-practice is available for ${getModeLabel(mode)} yet.`));
    return;
  }

  try {
    session = prepareSessionForPractice();
    saveSession();
  } catch (error) {
    renderError(error);
    return;
  }

  profile = recordLearningEvent(profile, {
    mode,
    surface: "practice",
    canDoId: session.target.canDoId,
    knowledgeIds: [...new Set(activities.flatMap((activity) => getKnowledgeForCanDo(knowledgeGraph, activity.canDoId).map((node) => node.id)))]
  });
  saveProfile();

  practice = {
    mode,
    activities,
    index: 0,
    results: [],
    finalAttempts: 0,
    currentResponse: null
  };

  clearSavedPracticeState();
  savePracticeState();
  renderMicroActivity();
}

function renderMicroActivity() {
  practice.answered = false;
  const activity = practice.activities[practice.index];
  if (!activity) {
    finishPractice();
    return;
  }

  const progress = practice.index + 1;
  const total = practice.activities.length;

  savePracticeState();

  app.innerHTML = `
    <section class="card practice-card">
      <div class="practice-nav">
        <button class="secondary compact practice-back" id="backToPracticeButton" type="button">← Back to modes</button>
        <span class="practice-nav-hint">Your progress is saved</span>
      </div>

      <div class="practice-topline">
        <span class="kicker">${escapeHtml(getModeLabel(practice.mode))} · ${progress}/${total}</span>
        <span class="practice-skill">${escapeHtml(activity.skill)}</span>
      </div>

      <h2>${escapeHtml(activity.title)}</h2>
      <p class="spanish activity-title-es">${escapeHtml(activity.titleEs || "")}</p>

      <div class="micro-prompt">
        <p class="prompt-en">${escapeHtml(activity.prompt)}</p>
        <p class="spanish">${escapeHtml(activity.promptEs || "")}</p>
      </div>

      <div id="microInteraction"></div>
      <div id="microFeedback" aria-live="polite"></div>

      <div class="micro-progress">
        <div class="progress-track"><div class="progress-fill" style="width:${(progress / total) * 100}%"></div></div>
      </div>
    </section>
  `;

  document.querySelector("#backToPracticeButton").addEventListener("click", () => {
    savePracticeState();
    renderPracticeHome();
  });

  renderInteraction(activity);
}

function renderInteraction(activity) {
  const container = document.querySelector("#microInteraction");

  if (activity.type === "choose" || activity.type === "listening") {
    const options = activity.options || [];
    container.innerHTML = `
      ${activity.type === "listening" ? `<button class="secondary audio-button" id="listenButton" type="button">▶ Listen</button>` : ""}
      <div class="answer-grid">
        ${options.map((option) => `<button class="answer-button" data-answer="${escapeHtml(option)}" type="button">${escapeHtml(option)}</button>`).join("")}
      </div>
    `;
    if (activity.type === "listening") {
      document.querySelector("#listenButton").addEventListener("click", () => speakText(activity.audioText));
    }
    document.querySelectorAll(".answer-button").forEach((button) => {
      button.addEventListener("click", () => evaluateCurrent(button.dataset.answer));
    });
    return;
  }

  if (activity.type === "complete") {
    container.innerHTML = `
      <input class="quick-input" id="quickAnswer" autocomplete="off" placeholder="Type your answer...">
      <button class="primary compact" id="checkButton" type="button">Check</button>
    `;
    bindTextAnswer();
    return;
  }

  if (activity.type === "order") {
    const shuffled = [...activity.tokens].sort(() => Math.random() - 0.5);
    container.innerHTML = `
      <div class="token-bank" id="tokenBank">
        ${shuffled.map((token) => `<button class="token" data-token="${escapeHtml(token)}" type="button">${escapeHtml(token)}</button>`).join("")}
      </div>
      <p class="selected-line" id="selectedLine"></p>
      <button class="primary compact" id="checkOrderButton" type="button">Check</button>
    `;
    const selected = [];
    document.querySelectorAll(".token").forEach((button) => {
      button.addEventListener("click", () => {
        selected.push(button.dataset.token);
        button.disabled = true;
        document.querySelector("#selectedLine").textContent = selected.join(" ");
      });
    });
    document.querySelector("#checkOrderButton").addEventListener("click", () => evaluateCurrent(selected));
    return;
  }

  if (activity.type === "match") {
    container.innerHTML = `
      <div class="answer-grid">
        ${activity.options.map((option) => `<button class="answer-button" data-answer="${escapeHtml(option)}" type="button">${escapeHtml(option)}</button>`).join("")}
      </div>
    `;
    document.querySelectorAll(".answer-button").forEach((button) => {
      button.addEventListener("click", () => evaluateCurrent(button.dataset.answer));
    });
    return;
  }

  if (activity.type === "speak") {
    container.innerHTML = `
      <div class="speak-card">
        <p class="model-label">Model pronunciation</p>
        <p class="model-sentence">${escapeHtml(activity.targetPhrase)}</p>
        ${activity.pronunciationHint ? `<div class="pronunciation-guide"><strong>How to read it · Cómo suena aproximadamente</strong><p>${escapeHtml(activity.pronunciationHint)}</p><small>Guía aproximada para hispanohablantes; escucha también el audio.</small></div>` : ""}
        <div class="audio-actions">
          <button class="secondary compact" id="normalAudioButton" type="button">▶ Listen</button>
          <button class="secondary compact" id="slowAudioButton" type="button">Slow</button>
        </div>
        <p class="spanish audio-hint">Listen first. Then say it yourself.</p>
        <button class="primary speak-button" id="speakButton" type="button">Speak</button>
        <details class="speak-fallback-details" id="speakFallbackDetails">
          <summary>Can't use voice? Type instead</summary>
          <textarea id="speakFallback" class="speak-fallback" placeholder="Type what you would say in English..."></textarea>
          <button class="secondary compact" id="checkSpeakButton" type="button">Check typed answer</button>
        </details>
      </div>
    `;
    document.querySelector("#normalAudioButton").addEventListener("click", () =>
      speakText(activity.audioText || activity.targetPhrase, activity.audio?.normalRate ?? 0.88)
    );
    document.querySelector("#slowAudioButton").addEventListener("click", () =>
      speakText(activity.audioText || activity.targetPhrase, activity.audio?.slowRate ?? 0.62)
    );
    document.querySelector("#speakButton").addEventListener("click", () => startSpeechRecognition(activity));
    document.querySelector("#checkSpeakButton").addEventListener("click", () => {
      evaluateCurrent(document.querySelector("#speakFallback").value);
    });
    return;
  }

  if (activity.type === "mini-production") {
    const isWriting = activity.skill === "writing";
    const criteria = activity.evaluation?.criteria || [];

    container.innerHTML = `
      <div class="production-guidance">
        <strong>${isWriting ? "Your writing should include:" : "Your response should include:"}</strong>
        <ul>
          ${criteria.map((criterion) => `<li>${escapeHtml(criterion.label)}</li>`).join("")}
        </ul>
      </div>

      ${isWriting ? `
        <textarea id="productionAnswer" class="production-input" placeholder="Write your answer in English..."></textarea>
        <button class="primary compact" id="finishButton" type="button">Check writing</button>
      ` : `
        <button class="primary speak-button" id="speakButton" type="button">Speak</button>
        <details class="speak-fallback-details" id="productionFallbackDetails">
          <summary>Can't use voice? Type instead</summary>
          <textarea id="productionAnswer" class="production-input" placeholder="Type what you would say in English..."></textarea>
          <button class="secondary compact" id="finishButton" type="button">Check typed response</button>
        </details>
      `}

      <details class="learning-hints" open>
        <summary>${isWriting ? "Help me build my answer" : "Help me prepare what to say"} <span class="spanish">Pistas para responder</span></summary>
        <div class="hint-content">
          <p><strong>Start with · Puedes comenzar con</strong></p>
          <div class="hint-chips"><span>I am...</span><span>I work...</span><span>I teach...</span><span>I have...</span><span>I like...</span><span>I enjoy...</span></div>
          <p><strong>Connect your ideas · Une las ideas</strong></p>
          <div class="hint-chips"><span>and = y</span><span>but = pero</span><span>because = porque</span><span>then = luego</span></div>
          <details class="model-answer"><summary>Show an example · Ver ejemplo</summary><p>I am a technology teacher. I work at a school. I enjoy building robotics projects with students.</p><p class="spanish">Soy profesor de tecnología. Trabajo en un colegio. Disfruto construir proyectos de robótica con estudiantes.</p></details>
        </div>
      </details>
      <p class="spanish requirement-note">
        Aim for 2–3 sentences. This is a guide for the task, not a measure of your English level.
      </p>
    `;

    if (isWriting) {
      const feedbackNode = document.querySelector("#microFeedback");
      const answerInput = document.querySelector("#productionAnswer");
      if (feedbackNode && answerInput) answerInput.insertAdjacentElement("afterend", feedbackNode);
    }

    const evaluateProduction = (response) => {
      const result = evaluateMicroActivity(activity, response);
      showFeedback(activity, result, response, { final: true });
    };

    document.querySelector("#finishButton")?.addEventListener("click", () => {
      evaluateProduction(document.querySelector("#productionAnswer").value.trim());
    });

    if (!isWriting) {
      document.querySelector("#speakButton").addEventListener("click", () =>
        startSpeechRecognition(activity, (transcript) => {
          const input = document.querySelector("#productionAnswer");
          if (input) input.value = transcript;
          evaluateProduction(transcript);
        })
      );
    }
  }
}

function bindTextAnswer() {
  const input = document.querySelector("#quickAnswer");
  const check = document.querySelector("#checkButton");
  check.addEventListener("click", () => evaluateCurrent(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      evaluateCurrent(input.value);
    }
  });
  input.focus();
}

function evaluateCurrent(response) {
  if (!practice || practice.answered) return;
  practice.answered = true;
  document.querySelectorAll("#microInteraction button, #microInteraction input, #microInteraction textarea")
    .forEach((control) => { control.disabled = true; });
  const activity = practice.activities[practice.index];
  const result = evaluateMicroActivity(activity, response);
  practice.currentResponse = response;
  showFeedback(activity, result, response);
}

function showFeedback(activity, result, response, options = {}) {
  const feedback = document.querySelector("#microFeedback");
  const isOpenProduction = activity.type === "mini-production";
  const feedbackContract = createFeedbackContract({
    activity,
    surface: activity.type === "listening" ? "listening" : isOpenProduction && activity.skill === "writing" ? "writing" : activity.skill === "speaking" || activity.type === "speak" ? "speaking" : "practice",
    skill: activity.skill,
    response,
    result,
    source: isOpenProduction ? "checklist" : activity.type === "listening" || ["choose", "complete", "order", "match"].includes(activity.type) ? "answer-key" : "rule-based"
  });
  const success = result.correct || result.score >= 1;
  const inlineCorrectedText = result.errors?.find((error) => error.correctedText)?.correctedText;
  const inlineWritingReview = activity.skill === "writing" && response && inlineCorrectedText ? renderInlineComparison(response, inlineCorrectedText) : "";
  const speechComparison = activity.type === "speak" && response ? renderSpeechComparison(activity.targetPhrase, response) : "";
  const missingError = result.errors?.find((error) => error.target === "required-information");
  const missingWords = (missingError?.correction || result.missing || "").toString();
  const feedbackText = missingError ? `Add the missing key word: ${missingWords}.` : (result.feedback || "");
  const feedbackTextEs = missingError ? `Añade la palabra clave que falta: ${missingWords}.` : (result.feedbackEs || "");
  feedback.innerHTML = `
    ${inlineWritingReview}
    ${speechComparison}
    <div class="instant-feedback ${success ? "feedback-success" : "feedback-retry"}">
      <strong>${success ? "✓ Correct · Correcto" : isOpenProduction ? "Review your answer · Revisa tu respuesta" : "Try again · Inténtalo de nuevo"}</strong>
      <p>${escapeHtml(feedbackText)}</p>
      <p class="spanish">${escapeHtml(feedbackTextEs)}</p>
      ${!success && !missingError && (activity.answer !== undefined || activity.targetPhrase) ? `<details class="feedback-next-step"><summary>See an example · Ver ejemplo</summary>${activity.answer !== undefined ? `<p><strong>Answer:</strong> ${escapeHtml(Array.isArray(activity.answer) ? activity.answer.join(" ") : String(activity.answer))}</p>` : ""}${activity.targetPhrase ? `<p><strong>Model:</strong> ${escapeHtml(activity.targetPhrase)}</p>` : ""}</details>` : ""}
      ${feedbackContract.corrections.length ? `
        <div class="feedback-corrections">
          ${feedbackContract.corrections.map((error) => `
            <div class="correction-item">
              ${error.target === "required-information" ? `<p class="missing-focus"><strong>Missing keyword · Palabra clave faltante:</strong> ${escapeHtml(error.correction || error.expected || "")}</p>` : `${error.actual ? `<p class="feedback-original">You wrote · Escribiste: <span>${escapeHtml(error.actual)}</span></p>` : ""}<strong>Suggested form · Forma sugerida: ${escapeHtml(error.correction || error.expected || "")}</strong>`}
              <p>${escapeHtml(error.message || "")}</p>
              ${error.messageEs ? `<p class="spanish">${escapeHtml(error.messageEs)}</p>` : ""}
              ${error.examples?.length ? `<p class="example-label">Examples: ${escapeHtml(error.examples.join(" · "))}</p>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
    ${success && !options.final ? `<button class="primary compact" id="nextMicroButton" type="button">Next activity →</button>` : ""}
    ${!success && !options.final ? `<button class="secondary compact" id="retryMicroButton" type="button">Try again</button>` : ""}
  `;

  // Bind visible controls before profile persistence; UI navigation must remain usable.
  document.querySelector("#nextMicroButton")?.addEventListener("click", () => {
    practice.index += 1;
    savePracticeState();
    renderMicroActivity();
    app.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelector("#retryMicroButton")?.addEventListener("click", () => {
    practice.answered = false;
    renderMicroActivity();
    app.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (options.final) {
    practice.finalAttempts += 1;
    const buttonLabel = success ? "Continue to progress" : "Continue with this attempt";
    const feedbackArea = document.querySelector("#microFeedback");
    feedbackArea.insertAdjacentHTML("beforeend", `
      <div class="actions final-feedback-actions">
        <button class="primary compact" id="submitEvidenceButton" type="button">${buttonLabel}</button>
        ${!success ? '<button class="secondary compact" id="retryFinalButton" type="button">Try again</button>' : ""}
      </div>
    `);
    document.querySelector("#submitEvidenceButton").addEventListener("click", () => submitFinalEvidence(response));
    document.querySelector("#retryFinalButton")?.addEventListener("click", () => renderMicroActivity());
    return;
  }

  profile = recordKnowledgeOutcome(profile, {
    activityId: activity.id,
    mode: practice.mode,
    canDoId: activity.canDoId,
    skill: activity.skill,
    knowledgeIds: getKnowledgeForActivity(knowledgeGraph, activity).map((node) => node.id),
    correct: success,
    score: result.score,
    errors: result.errors || [],
    independent: true
  });
  saveProfile();

  practice.results.push({
    activityId: activity.id,
    score: result.score,
    correct: success,
    errors: result.errors || []
  });


}

function startSpeechRecognition(activity, onTranscript = null) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = document.querySelector("#speakButton, #experienceSpeakButton");

  if (!Recognition) {
    document.querySelector("#speakFallbackDetails, #productionFallbackDetails, #experienceTyping")?.setAttribute("open", "");
    showSpeechFeedback(
      activity,
      "Speech recognition is not available in this browser. You can use the typing fallback.",
      "El reconocimiento de voz no está disponible en este navegador. Puedes usar la opción para escribir como alternativa."
    );
    return;
  }

  const handleRecognitionError = (event) => {
    const messages = {
      "not-allowed": [
        "Microphone access was denied. Allow microphone access and try again.",
        "El acceso al micrófono fue rechazado. Permite el micrófono en el navegador e inténtalo de nuevo."
      ],
      "service-not-allowed": [
        "The browser did not allow the speech recognition service.",
        "El navegador no permitió utilizar el servicio de reconocimiento de voz."
      ],
      "audio-capture": [
        "The microphone could not be accessed.",
        "No se pudo acceder al micrófono."
      ],
      "no-speech": [
        "No speech was detected. Try speaking a little closer to the microphone.",
        "No se detectó voz. Intenta hablar un poco más cerca del micrófono."
      ],
      "network": [
        "The speech recognition service could not be reached.",
        "No se pudo conectar con el servicio de reconocimiento de voz."
      ],
      "aborted": [
        "Speech recognition was interrupted. Try again.",
        "El reconocimiento de voz se interrumpió. Inténtalo de nuevo."
      ]
    };

    const [message, messageEs] = messages[event?.error] || [
      "Speech recognition could not complete. You can type your answer instead.",
      "El reconocimiento de voz no pudo completarse. Puedes escribir tu respuesta."
    ];

    showSpeechFeedback(activity, message, messageEs);
  };

  const recognition = new Recognition();
  activeSpeechRecognition = recognition;
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = button.id === "experienceSpeakButton";
  recognition.maxAlternatives = 1;

  button.textContent = "Listening...";
  button.disabled = true;

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results || []).map((result) => result?.[0]?.transcript || "").join(" ").trim();
    const fallback = document.querySelector("#speakFallback");
    if (fallback) fallback.value = transcript;

    if (transcript) {
      if (typeof onTranscript === "function") {
        onTranscript(transcript);
      } else {
        evaluateCurrent(transcript);
      }
    } else {
      showSpeechFeedback(
        activity,
        "No speech was recognized. You can try again or type your answer.",
        "No se reconoció voz. Puedes intentarlo de nuevo o escribir tu respuesta."
      );
    }
  };

  recognition.onerror = handleRecognitionError;

  recognition.onend = () => {
    // Only the active recognizer may alter the currently visible controls.
    if (activeSpeechRecognition !== recognition) return;

    activeSpeechRecognition = null;
    if (button.isConnected) {
      button.textContent = button.id === "experienceSpeakButton" ? "🎙 Start speaking" : "Speak";
      button.disabled = false;
    }
    const stopButton = document.querySelector("#experienceStopButton");
    if (stopButton) stopButton.disabled = true;
  };

  try {
    recognition.start();
  } catch (error) {
    showSpeechFeedback(
      activity,
      "The microphone session could not start. Check browser permissions and try again.",
      "No se pudo iniciar la sesión del micrófono. Revisa los permisos del navegador e inténtalo de nuevo."
    );
    activeSpeechRecognition = null;
    button.textContent = button.id === "experienceSpeakButton" ? "🎙 Start speaking" : "Speak";
    button.disabled = false;
    const stopButton = document.querySelector("#experienceStopButton");
    if (stopButton) stopButton.disabled = true;
  }
}

function showSpeechFeedback(activity, message, messageEs) {
  const experienceFeedback = document.querySelector("#experienceFeedback");
  if (experienceFeedback) {
    experienceFeedback.innerHTML = `
      <div class="instant-feedback feedback-retry">
        <strong>Voice input needs attention</strong>
        <p>${escapeHtml(message)}</p>
        <p class="spanish">${escapeHtml(messageEs)}</p>
        <p>You can type your answer instead.</p>
        <p class="spanish">Puedes escribir tu respuesta en lugar de usar la voz.</p>
      </div>
    `;
    document.querySelector("#experienceTyping")?.setAttribute("open", "");
    return;
  }

  if (!document.querySelector("#microFeedback")) return;
  showFeedback(activity, {
    correct: false,
    score: 0,
    feedback: message,
    feedbackEs: messageEs,
    errors: []
  });
}

function speakText(text, rate = 0.88) {
  if (!("speechSynthesis" in window)) {
    showSpeechFeedback(
      practice?.activities?.[practice.index],
      "Text-to-speech is not available in this browser.",
      "La lectura en voz alta no está disponible en este navegador."
    );
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

function finishPractice() {
  const last = practice.activities[practice.activities.length - 1];
  if (last?.type === "mini-production") return;
  clearSavedPracticeState();
  renderPracticeComplete();
}

function submitFinalEvidence(response) {
  const activity = practice.activities[practice.index];
  const finalResult = evaluateMicroActivity(activity, response);
  const scores = practice.results.map((item) => item.score);
  const microAverage = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
  const base = Math.min(0.95, Math.max(0.55, microAverage || finalResult.score || 0));
  const independent = finalResult.taskComplete === true && practice.finalAttempts === 1;

  const evidence = {
    canDoId: session.target.canDoId,
    sessionId: session.id,
    activityId: session.evidenceContract.assessmentActivityId,
    contextId: activity.context || "personal",
    timestamp: new Date().toISOString(),
    independent,
    confidence: 3,
    dimensions: {
      taskCompletion: finalResult.taskComplete ? 0.9 : Math.min(0.65, finalResult.score || 0),
      grammar: finalResult.languageErrors?.length ? Math.min(0.7, base) : Math.max(0.8, base),
      fluency: finalResult.correct ? Math.max(0.8, base) : base,
      vocabulary: finalResult.correct ? Math.max(0.8, base) : base
    },
    errors: [
      ...practice.results.flatMap((item) => item.errors || []),
      ...(finalResult.errors || [])
    ],
    supportUsed: []
  };

  try {
    const cycle = runSessionEvidenceCycle(matrix, library, profile, session, evidence);
    profile = cycle.result.profile;
    saveProfile();
    session = cycle.session;
    clearSavedSession();
    clearSavedPracticeState();
    renderResult(cycle);
  } catch (error) {
    renderError(error);
  }
}

function renderPracticeComplete() {
  app.innerHTML = `
    <section class="card practice-card">
      <p class="kicker">Practice complete</p>
      <h2>Good work.</h2>
      <p>You finished this practice set.</p>
      <p class="spanish">Terminaste esta sesión de práctica.</p>
      <div class="actions">
        <button class="primary" id="homeButton" type="button">Practice again</button>
      </div>
    </section>
  `;
  document.querySelector("#homeButton").addEventListener("click", renderPracticeHome);
}

function renderResult(cycle) {
  const retry = cycle.result.retryRequired;
  const next = cycle.nextSession;
  const status = cycle.result.canDo.status;
  app.innerHTML = `
    <section class="card practice-card">
      <p class="kicker">${retry ? "Let's reinforce this" : "Good progress"}</p>
      <h2>${retry ? "You need a little more practice." : "You made progress."}</h2>
      <div class="notice ${retry ? "recovery" : "success"}">
        <strong>${escapeHtml(status)}</strong>
        <p>${retry ? "HODIE keeps the same Can-Do and will give you another way to practice it." : "HODIE selected the next learning target from your updated evidence."}</p>
      </div>
      ${cycle.result.gap?.reason ? `<p class="spanish">${escapeHtml(cycle.result.gap.reason)}</p>` : ""}
      <div>
        <p><strong>Next</strong></p>
        <p>${escapeHtml(next.target.statement)}</p>
        <p class="spanish">${escapeHtml(next.target.spanish || "")}</p>
      </div>
      ${renderProgress()}
      <div class="actions">
        <button class="primary" id="continueButton" type="button">Continue</button>
      </div>
    </section>
  `;
  document.querySelector("#continueButton").addEventListener("click", () => {
    session = next;
    saveSession();
    renderPracticeHome();
  });
}

function renderError(error) {
  app.innerHTML = `
    <section class="card">
      <p class="kicker">HODIE error</p>
      <h2>Something needs attention.</h2>
      <p class="error">${escapeHtml(error.message)}</p>
    </section>
  `;
}

function renderInlineComparison(original, corrected) {
  const originalText = String(original ?? "");
  const correctedText = String(corrected ?? "");
  if (!originalText || !correctedText || originalText === correctedText) return "";
  const correctedWords = correctedText.match(/[\p{L}\p{N}’'-]+/gu) || [];
  const marked = originalText.replace(/[\p{L}\p{N}’'-]+/gu, (word) => {
    if (correctedWords.includes(word)) return escapeHtml(word);
    return '<mark class="inline-error-word" title="Review this word">' + escapeHtml(word) + '</mark>';
  });
  return '<div class="inline-writing-review"><p class="kicker">Your text · Tu texto</p><p class="inline-writing-text">' + marked + '</p><p class="inline-writing-corrected"><strong>Suggested version · Versión sugerida:</strong> ' + escapeHtml(correctedText) + '</p></div>';
}
function renderSpeechComparison(targetPhrase, transcript) {
  const target = String(targetPhrase ?? "").match(/[\p{L}\p{N}’'-]+/gu) || [];
  const heard = String(transcript ?? "").toLocaleLowerCase().match(/[\p{L}\p{N}’'-]+/gu) || [];
  if (!target.length || !heard.length) return "";
  const heardSet = new Set(heard);
  const missing = target.filter((word) => !heardSet.has(word.toLocaleLowerCase()));
  const marked = target.map((word) => heardSet.has(word.toLocaleLowerCase()) ? escapeHtml(word) : '<mark class="speech-word-review">' + escapeHtml(word) + '</mark>').join(" ");
  const note = missing.length ? 'The transcript did not clearly recognize: ' + escapeHtml(missing.join(", ")) + '. This is a transcription clue, not a precise pronunciation score.' : 'The key words appeared in the transcript. This does not measure pronunciation precisely.';
  return '<div class="speech-comparison"><strong>Words to review · Palabras para revisar</strong><p class="speech-target">' + marked + '</p><p class="spanish">' + note + '</p><p><strong>Recognized transcript · Transcripción reconocida:</strong> ' + escapeHtml(transcript) + '</p></div>';
}
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function boot() {
  try {
    setupTheme();
    setupInstallPrompt();
    registerServiceWorker();
    await loadData();
    loadProfile();

    const savedExperience = localStorage.getItem(EXPERIENCE_STATE_KEY);
    if (savedExperience) {
      try {
        const parsedExperience = JSON.parse(savedExperience);
        if (parsedExperience?.experienceId) experienceSession = parsedExperience;
      } catch {
        clearExperienceState();
      }
    }

    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try { session = JSON.parse(saved); } catch { clearSavedSession(); }
    }

    if (!session || !["planned", "started", "awaiting-evidence"].includes(session.state)) {
      session = createSession(matrix, library, profile, {
        contextTerms: ["technology", "work", "teacher", "programming"],
        sessionId: `session-${Date.now()}`
      });
      saveSession();
    }

    levelBadge.textContent = session.target.level;
    renderPracticeHome();

    // Mobile browsers can settle the responsive viewport after the first paint.
    // Recalculate once after the Home has been rendered so its initial layout
    // matches the same layout obtained after navigation.
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  } catch (error) {
    renderError(error);
  }
}

resetButton.addEventListener("click", () => {
  if (!confirm("Reset HODIE local progress?")) return;
  localStorage.removeItem(STORAGE_KEY);
  clearSavedSession();
  clearExperienceState();
  clearSavedPracticeState();
  location.reload();
});

boot();