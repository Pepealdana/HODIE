const EXERCISES = {
  "DO-NEG-BASE-001": {
    prompt: "He doesn't ___ on Fridays.",
    promptEs: "Él no ___ los viernes.",
    options: ["works", "work", "working"],
    answer: "work",
    explanation: "Doesn't + base verb.",
    explanationEs: "Doesn't + verbo en forma base."
  },
  "DID-NEG-BASE-001": {
    prompt: "They didn't ___ the robot yesterday.",
    promptEs: "Ellos no ___ el robot ayer.",
    options: ["built", "build", "building"],
    answer: "build",
    explanation: "Didn't already marks the past. Use the base verb.",
    explanationEs: "Didn't ya marca el pasado. Usa el verbo en forma base."
  },
  "MODAL-TO-BASE-001": {
    prompt: "I can ___ a robot.",
    promptEs: "Yo puedo ___ un robot.",
    options: ["to build", "building", "build"],
    answer: "build",
    explanation: "After can, use the base verb without to.",
    explanationEs: "Después de can, usa el verbo base sin to."
  },
  "ART-JOB-001": {
    prompt: "My mother is ___ engineer.",
    promptEs: "Mi madre es ___ ingeniera.",
    options: ["a", "an", "the"],
    answer: "an",
    explanation: "Use an before a vowel sound: an engineer.",
    explanationEs: "Usa an antes de un sonido vocálico: an engineer."
  },
  "ART-A-AN-001": {
    prompt: "He has ___ umbrella.",
    promptEs: "Él tiene ___ paraguas.",
    options: ["a", "an", "the"],
    answer: "an",
    explanation: "Umbrella begins with a vowel sound, so use an.",
    explanationEs: "Umbrella empieza con sonido vocálico; por eso usamos an."
  },
  "BE-SUBJECT-001": {
    prompt: "My friends ___ at school.",
    promptEs: "Mis amigos ___ en el colegio.",
    options: ["is", "am", "are"],
    answer: "are",
    explanation: "Use are with plural subjects such as my friends.",
    explanationEs: "Usamos are con sujetos plurales como my friends."
  },
  "PLURAL-COUNT-001": {
    prompt: "We have three ___ in the lab.",
    promptEs: "Tenemos tres ___ en el laboratorio.",
    options: ["computer", "computers", "computeres"],
    answer: "computers",
    explanation: "Use a plural noun after numbers greater than one.",
    explanationEs: "Usa un sustantivo plural después de números mayores que uno."
  },
  "THERE-BE-COUNT-001": {
    prompt: "___ a sensor on the table.",
    promptEs: "___ un sensor sobre la mesa.",
    options: ["There are", "There is", "There am"],
    answer: "There is",
    explanation: "Use there is with one singular countable noun.",
    explanationEs: "Usa there is con un sustantivo contable singular."
  },
  "DOES-BASE-001": {
    prompt: "Does she ___ English?",
    promptEs: "¿Ella ___ inglés?",
    options: ["speaks", "speak", "speaking"],
    answer: "speak",
    explanation: "After does in a question, use the base verb.",
    explanationEs: "Después de does en una pregunta, usa el verbo base."
  },
  "MODAL-BASE-001": {
    prompt: "You should ___ the instructions.",
    promptEs: "Deberías ___ las instrucciones.",
    options: ["to read", "read", "reading"],
    answer: "read",
    explanation: "After should, use the base verb without to.",
    explanationEs: "Después de should, usa el verbo base sin to."
  },
  "PAST-DID-BASE-001": {
    prompt: "Did they ___ the project?",
    promptEs: "¿Ellos ___ el proyecto?",
    options: ["finished", "finish", "finishing"],
    answer: "finish",
    explanation: "After did in a question, use the base verb.",
    explanationEs: "Después de did en una pregunta, usa el verbo base."
  },
  "PRES-CONT-BASE-001": {
    prompt: "She is ___ a new project now.",
    promptEs: "Ella está ___ un proyecto nuevo ahora.",
    options: ["build", "builds", "building"],
    answer: "building",
    explanation: "Present continuous uses be + verb-ing.",
    explanationEs: "El presente continuo usa be + verbo terminado en -ing."
  },
  "CAP-I-001": {
    prompt: "Choose the correct sentence.",
    promptEs: "Selecciona la oración correcta.",
    options: ["i am ready.", "I am ready.", "I Am ready."],
    answer: "I am ready.",
    explanation: "The English pronoun I is always capitalized.",
    explanationEs: "El pronombre I siempre se escribe con mayúscula."
  },
  "SPELL-TEACHER-001": {
    prompt: "I am an English ___.",
    promptEs: "Soy profesor(a) de inglés.",
    options: ["techer", "teacher", "teachar"],
    answer: "teacher",
    explanation: "The correct spelling is teacher.",
    explanationEs: "La escritura correcta es teacher."
  }
};

function createLearningOpportunity(ruleId) {
  const exercise = EXERCISES[String(ruleId || "").replace(/^LING-/, "")];
  return exercise ? { ruleId: String(ruleId).replace(/^LING-/, ""), ...exercise } : null;
}

function evaluateLearningOpportunity(opportunity, answer) {
  if (!opportunity) return { available: false, correct: null, answer: null };
  const selected = String(answer ?? "").trim();
  if (!selected) return { available: true, correct: null, answer: "", feedback: "Choose an answer first.", feedbackEs: "Primero selecciona una respuesta." };
  const correct = selected === opportunity.answer;
  return {
    available: true,
    correct,
    answer: selected,
    expected: opportunity.answer,
    feedback: correct ? "Correct. You applied the rule." : "Not yet. Review the explanation and try the pattern again.",
    feedbackEs: correct ? "Correcto. Aplicaste la regla." : "Todavía no. Revisa la explicación e inténtalo de nuevo."
  };
}

function recordLearningOpportunity(profile = {}, outcome = {}) {
  if (!outcome.ruleId || typeof outcome.correct !== "boolean") return profile;
  const history = Array.isArray(profile.learningOpportunities) ? profile.learningOpportunities : [];
  const record = {
    id: outcome.id || `learning-check-${Date.now()}-${history.length}`,
    ruleId: String(outcome.ruleId).replace(/^LING-/, ""),
    activityId: outcome.activityId || null,
    correct: outcome.correct,
    answer: outcome.answer ?? "",
    expected: outcome.expected ?? null,
    attempt: Math.max(1, Number(outcome.attempt) || 1),
    afterCorrection: outcome.afterCorrection !== false,
    at: outcome.at || new Date().toISOString()
  };
  return { ...profile, learningOpportunities: [...history, record].slice(-300) };
}

function summarizeLearningOpportunities(profile = {}) {
  const history = Array.isArray(profile.learningOpportunities) ? profile.learningOpportunities : [];
  const byRule = {};
  for (const item of history) {
    const current = byRule[item.ruleId] || { ruleId: item.ruleId, attempts: 0, correct: 0, firstTryCorrect: 0, lastAt: null };
    current.attempts += 1;
    current.correct += item.correct ? 1 : 0;
    current.firstTryCorrect += item.correct && item.attempt === 1 ? 1 : 0;
    if (!current.lastAt || String(item.at) > String(current.lastAt)) current.lastAt = item.at;
    byRule[item.ruleId] = current;
  }
  return {
    attempts: history.length,
    correct: history.filter((item) => item.correct).length,
    accuracy: history.length ? history.filter((item) => item.correct).length / history.length : 0,
    rules: Object.values(byRule).map((item) => ({ ...item, accuracy: item.attempts ? item.correct / item.attempts : 0 }))
  };
}

export { createLearningOpportunity, evaluateLearningOpportunity, recordLearningOpportunity, summarizeLearningOpportunities };
