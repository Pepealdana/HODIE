import { createSession, createSessionForCanDo } from "./src/learning-session.js";
import { startSession, requestEvidence } from "./src/session-state.js";
import { runSessionEvidenceCycle } from "./src/session-runner.js";
import { getProgressProfile, getStatus } from "./src/learning-engine.js";

const DATA = {
  matrix: "./data/can-do-matrix.json",
  library: "./data/content-library.json"
};
const STORAGE_KEY = "hodie-progress-v1";
const SESSION_KEY = "hodie-session-v1";

const app = document.querySelector("#app");
const levelBadge = document.querySelector("#levelBadge");
const resetButton = document.querySelector("#resetButton");

let matrix;
let library;
let profile;
let session;

async function loadData() {
  const [matrixResponse, libraryResponse] = await Promise.all([
    fetch(DATA.matrix),
    fetch(DATA.library)
  ]);
  if (!matrixResponse.ok || !libraryResponse.ok) throw new Error("Could not load HODIE learning data.");
  matrix = await matrixResponse.json();
  library = await libraryResponse.json();
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

function renderProgress() {
  const completed = new Set((profile.evidence || []).map((item) => item.canDoId));
  const ids = ["SP-A2-01", "SP-A2-02", "SP-A2-03", "SP-A2-04"];
  const count = ids.filter((id) => completed.has(id)).length;
  return `
    <div class="progress-row"><span>Vertical slice progress</span><strong>${count}/4</strong></div>
    <div class="progress-track"><div class="progress-fill" style="width:${count * 25}%"></div></div>
  `;
}

function renderMission() {
  const activity = session.stages.find((stage) => stage.kind === "target")?.activity;
  if (!activity) throw new Error("Session has no target activity.");

  const starters = activity.support?.optionalSentenceStarters || [];
  app.innerHTML = `
    <section class="card mission">
      <div>
        <p class="kicker">Today's mission · ${session.target.skill} · ${session.target.level}</p>
        <h2>${escapeHtml(activity.title)}</h2>
      <p class="spanish activity-title-es">${escapeHtml(activity.titleEs || "")}</p>
      </div>
      <div>
        <p><strong>Can-Do</strong></p>
        <p>${escapeHtml(session.target.statement)}</p>
        <p class="spanish">${escapeHtml(session.target.spanish || "")}</p>
      </div>
      <div class="task">
        <p><strong>Task</strong></p>
        <p>${escapeHtml(activity.task)}</p>
        <p class="spanish"><strong>Tarea:</strong> ${escapeHtml(activity.taskEs || "")}</p>
        <p class="spanish"><strong>Instructions in English:</strong> ${escapeHtml(activity.instructions)}</p>
        <p class="spanish"><strong>Instrucciones en español:</strong> ${escapeHtml(activity.instructionsEs || "")}</p>
      </div>
      ${starters.length ? `
        <div class="support">
          <p><strong>Optional support</strong></p>
          <ul>${starters.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>` : ""}
      ${renderProgress()}
      <div class="actions">
        <button class="primary" id="startButton" type="button">Start mission</button>
      </div>
    </section>
  `;
  document.querySelector("#startButton").addEventListener("click", startMission);
}

function renderActiveMission() {
  const activity = session.stages.find((stage) => stage.kind === "target")?.activity;
  app.innerHTML = `
    <section class="card mission">
      <p class="kicker">Mission in progress</p>
      <h2>${escapeHtml(activity.title)}</h2>
      <p class="spanish activity-title-es">${escapeHtml(activity.titleEs || "")}</p>
      <p>${escapeHtml(activity.task)}</p>
      <p class="spanish"><strong>En español:</strong> ${escapeHtml(activity.taskEs || "")}</p>
      <div>
        <label for="response"><strong>Your English</strong></label>
        <p class="spanish">Tu respuesta en inglés</p>
        <textarea id="response" placeholder="Write what you would say. In a future version, this area will also accept your voice."></textarea>
      </div>
      <div class="rating">
        <strong>How confident are you?</strong>
        <p class="spanish">¿Qué tan seguro te sientes?</p>
        <p class="spanish confidence-guide">1 = necesito mucha ayuda · 3 = puedo hacerlo con algo de ayuda · 5 = puedo hacerlo con confianza</p>
        <div class="rating-options">
          ${[1,2,3,4,5].map((n) => `
            <label><input type="radio" name="confidence" value="${n}" ${n === 3 ? "checked" : ""}>${n}</label>
          `).join("")}
        </div>
      </div>
      <div class="notice">
        <p>For this validation UI, evidence is self-assessed. Later HODIE will combine this with observable performance such as speaking/listening evidence.</p>
        <p class="spanish">En esta interfaz de validación, la evidencia es autoevaluada. Más adelante HODIE combinará esta autoevaluación con evidencia observable, como el desempeño al hablar y escuchar.</p>
      </div>
      <div class="actions">
        <button class="primary" id="submitButton" type="button">Submit evidence</button>
      </div>
    </section>
  `;
  document.querySelector("#submitButton").addEventListener("click", submitEvidence);
}

async function startMission() {
  session = startSession(session);
  session = requestEvidence(session);
  saveSession();
  renderActiveMission();
}

function submitEvidence() {
  const confidence = Number(document.querySelector('input[name="confidence"]:checked')?.value || 3);
  const response = document.querySelector("#response").value.trim();
  const independent = confidence >= 4 && response.length >= 40;
  const base = independent ? 0.82 : 0.58;
  const evidence = {
    canDoId: session.target.canDoId,
    sessionId: session.id,
    activityId: session.evidenceContract.assessmentActivityId,
    contextId: session.stages.find((stage) => stage.kind === "target")?.activity.context || "personal",
    timestamp: new Date().toISOString(),
    independent,
    confidence,
    dimensions: {
      taskCompletion: response.length >= 40 ? 0.85 : 0.55,
      grammar: base,
      fluency: base,
      vocabulary: base,
      pronunciation: base
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

function renderResult(cycle) {
  const retry = cycle.result.retryRequired;
  const next = cycle.nextSession;
  const status = cycle.result.canDo.status;
  app.innerHTML = `
    <section class="card mission">
      <p class="kicker">${retry ? "Recovery required" : "Good progress"}</p>
      <h2>${retry ? "Let's practice this again." : "You completed the mission."}</h2>
      <div class="notice ${retry ? "recovery" : "success"}">
        <strong>${escapeHtml(status)}</strong>
        <p>${retry ? "HODIE found a gap and kept the same Can-Do as the target." : "HODIE selected the next activity using your updated evidence."}</p>
      </div>
      ${cycle.result.gap?.reason ? `<p class="spanish">${escapeHtml(cycle.result.gap.reason)}</p>` : ""}
      <div>
        <p><strong>Next</strong></p>
        <p>${escapeHtml(next.target.statement)}</p>
        <p class="spanish">${escapeHtml(next.target.spanish || "")}</p>
      </div>
      ${renderProgress()}
      <div class="actions">
        <button class="primary" id="continueButton" type="button">${retry ? "Start recovery" : "Continue"}</button>
      </div>
    </section>
  `;
  document.querySelector("#continueButton").addEventListener("click", () => {
    session = next;
    saveSession();
    renderMission();
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
    if (session.state === "planned") renderMission();
    else renderActiveMission();
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
