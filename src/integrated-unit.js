function getIntegratedUnit(library, unitId) {
  return (library?.units || []).find((unit) => unit.id === unitId) || null;
}

function evaluateProduction(step, response) {
  const text = String(response ?? "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  const minimumWords = step.kind === "write" ? 6 : 4;
  const sentences = text.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  const normalized = text.toLowerCase();
  const targetTerms = step.keyTerms || ["robot", "sensor", "build", "use", "students"];
  const matchedTerms = targetTerms.filter((term) => {
    const family = {
      build: /\bbuild(?:s|ing|t)?\b/i,
      use: /\buse(?:s|d)?\b/i,
      student: /\bstudents?\b/i,
      robot: /\brobots?\b/i,
      sensor: /\bsensors?\b/i
    };
    return (family[term] || new RegExp("\\b" + term + "s?\\b", "i")).test(text);
  });
  const grammarIssues = [];
  if (/\bthe students\s+(?:builds|uses|has|is|does)\b/i.test(normalized)) {
    grammarIssues.push({
      id: "plural-subject",
      passed: false,
      feedback: "With “the students”, use the base verb: “The students build…”",
      feedbackEs: "Con «the students», usa el verbo base: «The students build…»"
    });
  }
  if (/\bthe robot\s+(?:build|use|have|are|do)\b/i.test(normalized)) {
    grammarIssues.push({
      id: "singular-subject",
      passed: false,
      feedback: "With “the robot”, remember the -s form: “The robot uses…”",
      feedbackEs: "Con «the robot», recuerda la forma con -s: «The robot uses…»"
    });
  }
  if (/\bi\s+is\b/i.test(normalized)) {
    grammarIssues.push({
      id: "i-am",
      passed: false,
      feedback: "Say “I am”, not “I is”.",
      feedbackEs: "Di «I am», no «I is»."
    });
  }

  const checks = [
    {
      id: "minimum-words",
      passed: words.length >= minimumWords,
      feedback: step.kind === "write" ? "Write at least 6 words." : "Say or write at least 4 words.",
      feedbackEs: step.kind === "write" ? "Escribe al menos 6 palabras." : "Di o escribe al menos 4 palabras."
    },
    {
      id: "multiple-sentences",
      passed: sentences.length >= 2,
      feedback: "Add a second short sentence to explain one more detail.",
      feedbackEs: "Añade una segunda oración corta para explicar otro detalle."
    },
    {
      id: "key-vocabulary",
      passed: matchedTerms.length >= 2,
      feedback: "Reuse at least two key words, for example “robot”, “sensor”, “build” or “use”.",
      feedbackEs: "Reutiliza al menos dos palabras clave, por ejemplo «robot», «sensor», «build» o «use»."
    },
    {
      id: "capitalization",
      passed: /^[A-Z]/.test(text),
      feedback: "Start your answer with a capital letter.",
      feedbackEs: "Comienza tu respuesta con una letra mayúscula."
    },
    {
      id: "punctuation",
      passed: /[.!?]$/.test(text),
      feedback: "Finish your answer with a period or another suitable punctuation mark.",
      feedbackEs: "Termina tu respuesta con un punto u otro signo de puntuación adecuado."
    },
    {
      id: "subject-verb-agreement",
      passed: grammarIssues.length === 0,
      feedback: "Check the subject and verb: “The students build” / “The robot uses”.",
      feedbackEs: "Revisa el sujeto y el verbo: «The students build» / «The robot uses»."
    }
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  const completed = words.length >= minimumWords;
  const firstIssue = [...grammarIssues, ...checks.filter((check) => !check.passed)][0];
  const feedback = !completed
    ? step.hint
    : firstIssue
      ? firstIssue.feedback
      : "Good structure. Compare your answer with the example and check that it says what you mean.";
  const feedbackEs = !completed
    ? step.hintEs
    : firstIssue
      ? firstIssue.feedbackEs
      : "Buena estructura. Compara tu respuesta con el ejemplo y comprueba que expresa lo que quieres decir.";

  return {
    correct: null,
    completed,
    score: passedChecks / checks.length,
    wordCount: words.length,
    sentenceCount: sentences.length,
    matchedTerms,
    checks: [...checks, ...grammarIssues],
    feedback,
    feedbackEs,
    evaluationNote: "Guided checklist, not an automatic grammar grade or CEFR assessment.",
    evaluationNoteEs: "Lista de comprobación orientativa; no es una nota gramatical automática ni una evaluación MCER."
  };
}

function evaluateIntegratedStep(step, response) {
  if (!step) return { correct: false, score: 0, feedback: "Step not found." };
  if (step.kind === "choose") {
    const correct = String(response ?? "").trim().toLowerCase() === String(step.answer ?? "").trim().toLowerCase();
    return { correct, score: correct ? 1 : 0, feedback: correct ? step.explanation : step.hint, feedbackEs: correct ? step.explanationEs : step.hintEs };
  }
  return evaluateProduction(step, response);
}

function createIntegratedUnitState(unit, saved = null) {
  if (!unit) throw new Error("Integrated unit not found.");
  if (saved?.unitId === unit.id && Array.isArray(saved.results)) return { ...saved, unit };
  return { unitId: unit.id, index: 0, results: [], responses: {}, complete: false, unit };
}

function submitIntegratedStep(state, response) {
  const step = state?.unit?.steps?.[state.index];
  if (!step || state.complete) return state;
  const evaluation = evaluateIntegratedStep(step, response);
  const result = { stepId: step.id, skill: step.skill, knowledgeIds: step.knowledgeIds || [], response: String(response ?? ""), ...evaluation, at: new Date().toISOString() };
  const results = [...state.results.filter((item) => item.stepId !== step.id), result];
  const responses = { ...state.responses, [step.id]: String(response ?? "") };
  return { ...state, results, responses, lastResult: result, complete: false };
}

function advanceIntegratedStep(state) {
  if (!state?.unit) return state;
  const nextIndex = state.index + 1;
  return { ...state, index: nextIndex, complete: nextIndex >= state.unit.steps.length };
}

function summarizeIntegratedUnit(state) {
  const results = state?.results || [];
  return { completedSteps: results.length, totalSteps: state?.unit?.steps?.length || 0, correctSteps: results.filter((item) => item.correct === true).length, selfReviewSteps: results.filter((item) => item.correct === null).length, skills: [...new Set(results.map((item) => item.skill))], knowledgeIds: [...new Set(results.flatMap((item) => item.knowledgeIds || []))] };
}

export { getIntegratedUnit, evaluateIntegratedStep, createIntegratedUnitState, submitIntegratedStep, advanceIntegratedStep, summarizeIntegratedUnit };
