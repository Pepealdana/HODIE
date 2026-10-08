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
const PRACTICE_STATE_KEY = "hodie-practice-v1";

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
  const modeGroups = [
    {
      title: "Practice",
      titleEs: "Modo",
      items: [
        ["mixed", "Mixed", "Un poco de todo", "Recommended"],
        ["review", "Review", "Refuerza lo que necesitas", "Adaptive"]
      ]
    },
    {
      title: "Focus",
      titleEs: "Habilidad",
      items: [
        ["speaking", "Speaking", "Hablar", "Focus"],
        ["listening", "Listening", "Escuchar", "Focus"],
        ["writing", "Writing", "Escribir", "Focus"]
      ]
    },
    {
      title: "Language",
      titleEs: "Recursos",
      items: [
        ["grammar", "Grammar", "Gramática", "Practice"],
        ["vocabulary", "Vocabulary", "Vocabulario", "Practice"]
      ]
    }
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
        <div class="choice-heading">
          <div>
            <p class="choice-title">Choose how to practice</p>
            <p class="spanish">Toca una opción para empezar. No necesitas otro botón.</p>
          </div>
          <span class="choice-hint">Tap → practice</span>
        </div>

        <div class="mode-groups">
          ${modeGroups.map((group) => `
            <section class="mode-group" aria-labelledby="mode-${group.title.toLowerCase()}">
              <div class="mode-group-title">
                <strong id="mode-${group.title.toLowerCase()}">${group.title}</strong>
                <span>${group.titleEs}</span>
              </div>
              <div class="mode-grid">
                ${group.items.map(([value, en, es, meta]) => `
                  <button class="mode-button" data-mode="${value}" type="button" aria-label="${en}: ${es}">
                    <span class="mode-copy">
                      <strong>${en}</strong>
                      <span>${es}</span>
                      <small class="mode-meta">${meta}</small>
                    </span>
                    <span class="mode-arrow" aria-hidden="true">→</span>
                  </button>
                `).join("")}
              </div>
            </section>
          `).join("")}
        </div>
      </div>

      ${savedPractice ? `
        <div class="resume-practice">
          <div>
            <strong>Resume practice</strong>
            <p class="spanish">${escapeHtml(savedPractice.mode)} · ${savedPractice.current}/${savedPractice.total}</p>
          </div>
          <button class="secondary compact" id="resumePracticeButton" type="button">Continue</button>
        </div>
      ` : ""}

      <aside class="quick-principle" aria-label="HODIE practice principle">
        <strong>Practice, don't just study.</strong>
        <span>Act → get feedback → try again → move on.</span>
      </aside>

      <div class="home-progress">
        ${renderProgress()}
      </div>
    </section>
  `;

  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => startPractice(button.dataset.mode));
  });

  document.querySelector("#resumePracticeButton")?.addEventListener("click", resumeSavedPractice);
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
        <button class="secondary compact" id="backToPracticeButton" type="button">← Back</button>
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
          <button class="secondary compact" id="slowAudioButton" type="button">🐢 Slow</button>
        </div>
        <p class="spanish audio-hint">Listen first, then try to say it yourself.</p>
        <button class="primary speak-button" id="speakButton" type="button">🎙 Speak</button>
        <textarea id="speakFallback" class="speak-fallback" placeholder="If voice recognition is unavailable, type what you would say."></textarea>
        <button class="secondary compact" id="checkSpeakButton" type="button">Check typed answer</button>
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
      <textarea id="productionAnswer" class="production-input" placeholder="${isWriting ? "Write your answer in English..." : "Say or write your answer in English..."}"></textarea>
      <p class="spanish requirement-note">Minimum: ${activity.requirements?.minResponseCharacters || activity.evaluation?.minimumResponseCharacters || 0} characters. This is a guide for this task, not a measure of your English level.</p>
      <div class="actions">
        <button class="primary" id="finishButton" type="button">${isWriting ? "Check writing" : "Finish practice"}</button>
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
      ${result.corrections?.length ? `
        <div class="feedback-corrections">
          ${result.corrections.map((error) => `
            <div class="correction-item">
              <strong>${escapeHtml(error.correction || error.expected || "")}</strong>
              <p>${escapeHtml(error.message || "")}</p>
              ${error.messageEs ? `<p class="spanish">${escapeHtml(error.messageEs)}</p>` : ""}
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
    if (success) {
      submitFinalEvidence(response);
    } else {
      document.querySelector("#finishButton")?.focus();
    }
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

function startSpeechRecognition(activity) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = document.querySelector("#speakButton");

  if (!Recognition) {
    showSpeechFeedback(
      activity,
      "Speech recognition is not available in this browser.",
      "El reconocimiento de voz no está disponible en este navegador. Esto no significa que el micrófono esté dañado."
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
      evaluateCurrent(transcript);
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
    button.textContent = "🎙 Speak";
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
    button.textContent = "🎙 Speak";
    button.disabled = false;
  }
}

function showSpeechFeedback(activity, message, messageEs) {
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
  const independent = finalResult.correct === true && practice.finalAttempts === 1;

  const evidence = {
    canDoId: session.target.canDoId,
    sessionId: session.id,
    activityId: session.evidenceContract.assessmentActivityId,
    contextId: activity.context || "personal",
    timestamp: new Date().toISOString(),
    independent,
    confidence: 3,
    dimensions: {
      taskCompletion: independent ? 0.9 : Math.min(0.65, finalResult.score || 0),
      grammar: finalResult.correct ? Math.max(0.8, base) : base,
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
  clearSavedPracticeState();
  location.reload();
});

boot();
