import { createSession } from "./src/learning-session.js";
import { startSession, requestEvidence } from "./src/session-state.js";
import { runSessionEvidenceCycle } from "./src/session-runner.js";
import { getStatus } from "./src/learning-engine.js";
import { selectMicroActivities, evaluateMicroActivity, getModeLabel } from "./src/micro-practice.js";
import { getExperience, selectExperiences, createExperienceSession, evaluateExperienceTurn, advanceExperienceSession, isExperienceComplete, summarizeExperience } from "./src/experience-engine.js";
import { chooseLearningSurface } from "./src/learning-orchestrator.js";
import { buildKnowledgeGraph, getKnowledgeForCanDo } from "./src/knowledge-graph.js";
import { recordLearningEvent, summarizeLearningProfile } from "./src/learning-profile.js";

const DATA = {
  matrix: "./data/can-do-matrix.json",
  library: "./data/content-library.json",
  micro: "./data/micro-practice-library.json",
  experiences: "./data/experience-library.json",
  contexts: "./data/learning-contexts.json",
  knowledge: "./data/knowledge-library.json"
};

const STORAGE_KEY = "hodie-progress-v1";
const SESSION_KEY = "hodie-session-v1";
const PRACTICE_STATE_KEY = "hodie-practice-v1";
const EXPERIENCE_STATE_KEY = "hodie-experience-v1";
const THEME_KEY = "hodie-theme-v1";

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
let experienceSession = null;
let deferredInstallPrompt = null;


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
    const registration = await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
    // Ask the browser to check for a newer worker when HODIE is opened.
    await registration.update();
  } catch (error) {
    console.warn("HODIE Service Worker registration failed.", error);
  }
}

async function loadData() {
  const [matrixResponse, libraryResponse, microResponse, experienceResponse, contextResponse, knowledgeResponse] = await Promise.all([
    fetch(DATA.matrix),
    fetch(DATA.library),
    fetch(DATA.micro),
    fetch(DATA.experiences),
    fetch(DATA.contexts)
  ]);
  if (!matrixResponse.ok || !libraryResponse.ok || !microResponse.ok || !experienceResponse.ok || !contextResponse.ok || !knowledgeResponse.ok) {
    throw new Error("Could not load HODIE learning data.");
  }
  matrix = await matrixResponse.json();
  library = await libraryResponse.json();
  microLibrary = await microResponse.json();
  experienceLibrary = await experienceResponse.json();
  contextLibrary = await contextResponse.json();
  knowledgeLibrary = await knowledgeResponse.json();
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
    contextTerms: ["technology", "teaching", "professional"]
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

      <details class="choice-disclosure advanced-choices">
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

      <div class="home-progress">
        ${renderProgress()}
      </div>
    </section>
  `;

  document.querySelector("#recommendedLearningButton").addEventListener("click", recommendedAction);

  document.querySelectorAll("[data-primary-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.primaryMode;
      if (value === "conversation") {
        const item = conversations[0];
        if (item) startExperience(item.id);
        return;
      }
      if (value === "simulation") {
        const item = simulations[0];
        if (item) startExperience(item.id);
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

      <div class="conversation-response">
        <button class="primary" id="experienceSpeakButton" type="button">🎙 Speak</button>
        <details class="speak-fallback-details" id="experienceTyping">
          <summary>Type your answer instead</summary>
          <textarea id="experienceResponse" class="production-input" placeholder="Answer in English..."></textarea>
          <button class="secondary compact" id="experienceCheckButton" type="button">Send answer</button>
        </details>
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
        submit(transcript);
      }
    );
  });
}

function handleExperienceResponse(experience, stage, response) {
  const result = evaluateExperienceTurn(experience, stage, response);
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

  feedback.innerHTML = `
    <div class="instant-feedback feedback-success">
      <strong>Keep going</strong>
      <p>Your idea is recorded. Now notice the feedback below.</p>
      <p class="spanish">Tu idea está registrada. Ahora revisa la retroalimentación.</p>
      ${result.missing.length ? `<p>Useful idea to add: ${escapeHtml(result.missing.join(", "))}</p>` : ""}
      ${result.corrections.length ? `
        <div class="feedback-corrections">
          ${result.corrections.map((error) => `
            <div class="correction-item">
              <strong>Suggested: ${escapeHtml(error.correction || error.expected || "")}</strong>
              <p>${escapeHtml(error.message || "")}</p>
              <p class="spanish">${escapeHtml(error.messageEs || "")}</p>
              ${error.examples?.length ? `<p class="example-label">Examples: ${escapeHtml(error.examples.join(" · "))}</p>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
      <div class="actions">
        <button class="primary compact" id="nextExperienceButton" type="button">${experienceSession.index + 1 >= experience.stages.length ? "Finish" : "Next"}</button>
      </div>
    </div>
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

      ${summary.corrections.length ? `
        <div class="experience-summary">
          <h3>Useful corrections</h3>
          ${summary.corrections.slice(0, 6).map((error) => `
            <div class="correction-item">
              <strong>${escapeHtml(error.correction || error.expected || "")}</strong>
              <p>${escapeHtml(error.message || "")}</p>
              <p class="spanish">${escapeHtml(error.messageEs || "")}</p>
            </div>
          `).join("")}
        </div>
      ` : `
        <p>No priority corrections were detected in this experience.</p>
      `}

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

      <p class="spanish requirement-note">
        Aim for 2–3 sentences. This is a guide for the task, not a measure of your English level.
      </p>
    `;

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
  const success = result.correct || result.score >= 1;
  feedback.innerHTML = `
    <div class="instant-feedback ${success ? "feedback-success" : "feedback-retry"}">
      <strong>${success ? "✓ Good" : "Try again"}</strong>
      <p>${escapeHtml(result.feedback || "")}</p>
      <p class="spanish">${escapeHtml(result.feedbackEs || "")}</p>
      ${result.missing?.length ? `<p class="spanish">Missing: ${escapeHtml(result.missing.join(", "))}</p>` : ""}
      ${result.corrections?.length ? `
        <div class="feedback-corrections">
          ${result.corrections.map((error) => `
            <div class="correction-item">
              <strong>Suggested: ${escapeHtml(error.correction || error.expected || "")}</strong>
              <p>${escapeHtml(error.message || "")}</p>
              ${error.messageEs ? `<p class="spanish">${escapeHtml(error.messageEs)}</p>` : ""}
              ${error.examples?.length ? `<p class="example-label">Examples: ${escapeHtml(error.examples.join(" · "))}</p>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
    ${success && !options.final ? `<p class="auto-next">Next...</p>` : ""}
    ${!success && !options.final ? `<button class="secondary compact" id="retryMicroButton" type="button">Try again</button>` : ""}
  `;

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

  practice.results.push({
    activityId: activity.id,
    score: result.score,
    correct: success,
    errors: result.errors || []
  });

  if (success) {
    window.setTimeout(() => {
      practice.index += 1;
      savePracticeState();
      renderMicroActivity();
    }, 850);
  } else {
    document.querySelector("#retryMicroButton").addEventListener("click", () => {
      renderMicroActivity();
    });
  }
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
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  button.textContent = "Listening...";
  button.disabled = true;

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
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
    button.textContent = "Speak";
    button.disabled = false;
  };

  try {
    recognition.start();
  } catch (error) {
    showSpeechFeedback(
      activity,
      "The microphone session could not start. Check browser permissions and try again.",
      "No se pudo iniciar la sesión del micrófono. Revisa los permisos del navegador e inténtalo de nuevo."
    );
    button.textContent = "Speak";
    button.disabled = false;
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