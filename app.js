import { createSession } from "./src/learning-session.js";
import { startSession, requestEvidence } from "./src/session-state.js";
import { runSessionEvidenceCycle } from "./src/session-runner.js";
import { getStatus } from "./src/learning-engine.js";
import { selectMicroActivities, evaluateMicroActivity, getModeLabel } from "./src/micro-practice.js";

const DATA = {
  matrix: "./data/can-do-matrix.json",
  library: "./data/content-library.json",
  micro: "./data/micro-practice-library.json"
};

const STORAGE_KEY = "hodie-progress-v1";
const SESSION_KEY = "hodie-session-v1";

const app = document.querySelector("#app");
const levelBadge = document.querySelector("#levelBadge");
const resetButton = document.querySelector("#resetButton");

let matrix;
let library;
let microLibrary;
let profile;
let session;
let practice = null;

async function loadData() {
  const [matrixResponse, libraryResponse, microResponse] = await Promise.all([
    fetch(DATA.matrix),
    fetch(DATA.library),
    fetch(DATA.micro)
  ]);
  if (!matrixResponse.ok || !libraryResponse.ok || !microResponse.ok) {
    throw new Error("Could not load HODIE learning data.");
  }
  matrix = await matrixResponse.json();
  library = await libraryResponse.json();
  microLibrary = await microResponse.json();
}

function loadProfile() {
  try {
    profile = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { evidence: [], reviews: [] };
  } catch {
    profile = { evidence: [], reviews: [] };
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
  const modes = [
    ["mixed", "Mixed", "Un poco de todo"],
    ["speaking", "Speaking", "Hablar"],
    ["listening", "Listening", "Escuchar"],
    ["grammar", "Grammar", "Gramática"],
    ["vocabulary", "Vocabulary", "Vocabulario"],
    ["review", "Review", "Repasar lo que necesitas"]
  ];

  app.innerHTML = `
    <section class="card practice-home">
      <div class="home-intro">
        <p class="kicker">Today's practice · ${escapeHtml(session.target.level)}</p>
        <h2>${escapeHtml(targetActivity?.title || "Practice English")}</h2>
        <p class="spanish activity-title-es">${escapeHtml(targetActivity?.titleEs || "")}</p>
        <p class="can-do-line">${escapeHtml(statement)}</p>
        <p class="spanish">${escapeHtml(spanish)}</p>
      </div>

      <div class="practice-choice">
        <div>
          <p class="choice-title">How do you want to practice?</p>
          <p class="spanish">Puedes escoger o dejar que HODIE mezcle las habilidades.</p>
        </div>
        <div class="mode-grid">
          ${modes.map(([value, en, es]) => `
            <button class="mode-button ${value === "mixed" ? "selected" : ""}" data-mode="${value}" type="button">
              <strong>${en}</strong>
              <span>${es}</span>
            </button>
          `).join("")}
        </div>
      </div>

      <div class="quick-principle">
        <strong>Practice, don't just study.</strong>
        <span>Act → get feedback → try again → move on.</span>
      </div>

      ${renderProgress()}

      <div class="actions">
        <button class="primary" id="practiceButton" type="button">Start practice</button>
      </div>
    </section>
  `;

  let selectedMode = "mixed";
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMode = button.dataset.mode;
      document.querySelectorAll(".mode-button").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    });
  });

  document.querySelector("#practiceButton").addEventListener("click", () => startPractice(selectedMode));
}

function startPractice(mode) {
  const activities = selectMicroActivities(microLibrary, {
    canDoId: session.target.canDoId,
    mode,
    limit: 6
  });

  if (!activities.length) {
    renderError(new Error(`No micro-practice is available for ${getModeLabel(mode)} yet.`));
    return;
  }

  session = startSession(session);
  session = requestEvidence(session);
  saveSession();

  practice = {
    mode,
    activities,
    index: 0,
    results: [],
    currentResponse: null
  };

  renderMicroActivity();
}

function renderMicroActivity() {
  const activity = practice.activities[practice.index];
  if (!activity) {
    finishPractice();
    return;
  }

  const progress = practice.index + 1;
  const total = practice.activities.length;

  app.innerHTML = `
    <section class="card practice-card">
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
        <p class="model-sentence">${escapeHtml(activity.targetPhrase)}</p>
        <button class="primary speak-button" id="speakButton" type="button">🎙 Speak</button>
        <textarea id="speakFallback" class="speak-fallback" placeholder="If voice recognition is unavailable, type what you would say."></textarea>
        <button class="secondary compact" id="checkSpeakButton" type="button">Check typed answer</button>
      </div>
    `;
    document.querySelector("#speakButton").addEventListener("click", () => startSpeechRecognition(activity));
    document.querySelector("#checkSpeakButton").addEventListener("click", () => {
      evaluateCurrent(document.querySelector("#speakFallback").value);
    });
    return;
  }

  if (activity.type === "mini-production") {
    container.innerHTML = `
      <textarea id="productionAnswer" class="production-input" placeholder="Say or write your answer in English..."></textarea>
      <p class="spanish requirement-note">Minimum: ${activity.requirements?.minResponseCharacters || 0} characters. This is a guide for this task, not a measure of your English level.</p>
      <div class="actions">
        <button class="primary" id="finishButton" type="button">Finish practice</button>
      </div>
    `;
    document.querySelector("#finishButton").addEventListener("click", () => {
      const response = document.querySelector("#productionAnswer").value.trim();
      const result = evaluateMicroActivity(activity, response);
      showFeedback(activity, result, response, { final: true });
    });
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
    </div>
    ${success && !options.final ? `<p class="auto-next">Next...</p>` : ""}
    ${!success && !options.final ? `<button class="secondary compact" id="retryMicroButton" type="button">Try again</button>` : ""}
  `;

  if (options.final) {
    if (success) {
      submitFinalEvidence(response);
    } else {
      document.querySelector("#finishButton")?.focus();
    }
    return;
  }

  if (success) {
    practice.results.push({ activityId: activity.id, score: result.score, correct: true });
    window.setTimeout(() => {
      practice.index += 1;
      renderMicroActivity();
    }, 850);
  } else {
    document.querySelector("#retryMicroButton").addEventListener("click", () => {
      renderMicroActivity();
    });
  }
}

function startSpeechRecognition(activity) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    showFeedback(activity, {
      correct:false,
      score:0,
      feedback:activity.feedback.unavailable,
      feedbackEs:activity.feedback.unavailableEs
    });
    return;
  }

  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const button = document.querySelector("#speakButton");
  button.textContent = "Listening...";
  button.disabled = true;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const fallback = document.querySelector("#speakFallback");
    if (fallback) fallback.value = transcript;
    evaluateCurrent(transcript);
  };

  recognition.onerror = () => {
    showFeedback(activity, {
      correct:false,
      score:0,
      feedback:activity.feedback.unavailable,
      feedbackEs:activity.feedback.unavailableEs
    });
  };

  recognition.onend = () => {
    button.textContent = "🎙 Speak";
    button.disabled = false;
  };

  recognition.start();
}

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
}

function finishPractice() {
  const last = practice.activities[practice.activities.length - 1];
  if (last?.type === "mini-production") return;
  renderPracticeComplete();
}

function submitFinalEvidence(response) {
  const activity = practice.activities[practice.index];
  const scores = practice.results.map((item) => item.score);
  const microAverage = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
  const responseLength = response.trim().length;
  const independent = microAverage >= 0.7 && responseLength >= (activity.requirements?.minResponseCharacters || 40);
  const base = Math.min(0.95, Math.max(0.55, microAverage));

  const evidence = {
    canDoId: session.target.canDoId,
    sessionId: session.id,
    activityId: session.evidenceContract.assessmentActivityId,
    contextId: activity.context || "personal",
    timestamp: new Date().toISOString(),
    independent,
    confidence: 3,
    dimensions: {
      taskCompletion: independent ? 0.86 : 0.58,
      grammar: base,
      fluency: base,
      vocabulary: base,
      pronunciation: practice.results.some((item) => item.activityId === "MIC-SP-A2-01-06") ? base : 0.6
    },
    errors: [],
    supportUsed: []
  };

  try {
    const cycle = runSessionEvidenceCycle(matrix, library, profile, session, evidence);
    profile = cycle.result.profile;
    saveProfile();
    session = cycle.session;
    clearSavedSession();
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
    await loadData();
    loadProfile();

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
  } catch (error) {
    renderError(error);
  }
}

resetButton.addEventListener("click", () => {
  if (!confirm("Reset HODIE local progress?")) return;
  localStorage.removeItem(STORAGE_KEY);
  clearSavedSession();
  location.reload();
});

boot();
