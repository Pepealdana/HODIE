const CONTRACT_VERSION = "1.0.0";

const STATUS = new Set(["empty", "correct", "needs-work", "partial", "self-review", "unavailable"]);
const SOURCES = new Set(["rule-based", "answer-key", "checklist", "speech-recognition", "ai", "unknown"]);

function normalizeCorrection(item = {}) {
  return {
    id: item.id || null,
    type: item.type || "language",
    target: item.target || item.id || null,
    actual: item.actual ?? null,
    expected: item.expected ?? item.correction ?? null,
    correction: item.correction ?? item.expected ?? null,
    message: item.message || item.feedback || "",
    messageEs: item.messageEs || item.feedbackEs || "",
    examples: Array.isArray(item.examples) ? item.examples : [],
    priority: item.priority || item.severity || "medium",
    retry: item.retry !== false
  };
}

function normalizeMissing(item = {}) {
  if (typeof item === "string") return { id: item, label: item, message: item, messageEs: "" };
  return {
    id: item.id || item.target || null,
    label: item.label || item.id || item.target || "Missing requirement",
    message: item.missingMessage || item.message || "",
    messageEs: item.missingMessageEs || item.messageEs || ""
  };
}

function createFeedbackContract({ activity = {}, surface = "practice", skill = null, response = "", result = {}, source = null } = {}) {
  const text = String(response ?? "").trim();
  const responseProvided = text.length > 0;
  const rawCorrections = [
    ...(Array.isArray(result.corrections) ? result.corrections : []),
    ...(Array.isArray(result.languageErrors) ? result.languageErrors : []),
    ...(Array.isArray(result.languageNotes) ? result.languageNotes : [])
  ];
  const corrections = [];
  const seenCorrections = new Set();
  for (const item of rawCorrections) {
    const normalized = normalizeCorrection(item);
    const key = [normalized.type, normalized.target, normalized.actual, normalized.expected].join("|");
    if (!seenCorrections.has(key)) {
      seenCorrections.add(key);
      corrections.push(normalized);
    }
  }

  const rawMissing = [
    ...(Array.isArray(result.missing) ? result.missing : []),
    ...(Array.isArray(result.criteria) ? result.criteria.filter((item) => item.matched === false) : []),
    ...(Array.isArray(result.checks) ? result.checks.filter((item) => item.passed === false) : [])
  ];
  const missing = [];
  const seenMissing = new Set();
  for (const item of rawMissing) {
    const normalized = normalizeMissing(item);
    const key = normalized.id || normalized.label;
    if (!seenMissing.has(key)) {
      seenMissing.add(key);
      missing.push(normalized);
    }
  }

  const correct = result.correct === true || result.success === true;
  const explicitlyIncorrect = result.correct === false || result.success === false;
  let status = "partial";
  if (!responseProvided) status = "empty";
  else if (correct) status = "correct";
  else if (result.correct === null) status = "self-review";
  else if (explicitlyIncorrect) status = "needs-work";
  else if (result.available === false) status = "unavailable";
  if (!STATUS.has(status)) status = "partial";

  const nextAction = !responseProvided
    ? { kind: "respond", title: "Try an answer", titleEs: "Intenta responder", instruction: "Write or say a short answer.", instructionEs: "Escribe o di una respuesta breve." }
    : corrections.some((item) => item.retry)
      ? { kind: "retry-correction", title: "Try the correction", titleEs: "Practica la corrección", instruction: "Use the corrected form in a new sentence.", instructionEs: "Usa la forma corregida en una nueva oración." }
      : missing.length
        ? { kind: "complete-missing", title: "Add the missing idea", titleEs: "Añade la idea que falta", instruction: missing[0].message || "Add one detail that addresses the missing requirement.", instructionEs: missing[0].messageEs || "Añade un detalle que responda al criterio que falta." }
        : status === "self-review"
          ? { kind: "self-review", title: "Compare your answer", titleEs: "Compara tu respuesta", instruction: "Compare your response with the example and check that it expresses your meaning.", instructionEs: "Compara tu respuesta con el ejemplo y comprueba que expresa lo que quieres decir." }
          : status === "needs-work"
            ? { kind: "retry", title: "Try again", titleEs: "Inténtalo de nuevo", instruction: result.feedback || "Review the hint and try again.", instructionEs: result.feedbackEs || "Revisa la ayuda e inténtalo de nuevo." }
            : { kind: "continue", title: "Continue", titleEs: "Continúa", instruction: "Continue to the next activity.", instructionEs: "Continúa con la siguiente actividad." };

  const words = text.match(/[\\p{L}\\p{N}’'-]+/gu) || [];
  const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  const inferredSource = source || (Array.isArray(result.checks) ? "checklist" : (result.correct === true || result.correct === false ? "answer-key" : "rule-based"));

  return {
    contractVersion: CONTRACT_VERSION,
    activityId: activity.id || result.activityId || null,
    surface,
    skill: skill || activity.skill || result.skill || "integrated",
    responseProvided,
    status,
    source: SOURCES.has(inferredSource) ? inferredSource : "unknown",
    strengths: Array.isArray(result.strengths) ? result.strengths.map((item) => ({
      id: item.id || null,
      label: item.label || item.id || "Strength",
      message: item.message || "",
      messageEs: item.messageEs || ""
    })) : [],
    corrections: corrections.slice(0, 3),
    missing: missing.slice(0, 5),
    nextAction,
    metrics: {
      wordCount: Number.isFinite(result.wordCount) ? result.wordCount : words.length,
      sentenceCount: Number.isFinite(result.sentenceCount) ? result.sentenceCount : sentences.length,
      score: Number.isFinite(result.score) ? Math.max(0, Math.min(1, result.score)) : null
    },
    limits: [
      result.feedbackLimit,
      result.evaluationNote,
      result.evaluationNoteEs
    ].filter((item, index, list) => typeof item === "string" && item.trim() && list.indexOf(item) === index)
  };
}

export { CONTRACT_VERSION, createFeedbackContract };
