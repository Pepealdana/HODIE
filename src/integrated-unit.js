function getIntegratedUnit(library, unitId) {
  return (library?.units || []).find((unit) => unit.id === unitId) || null;
}

function evaluateIntegratedStep(step, response) {
  if (!step) return { correct: false, score: 0, feedback: "Step not found." };
  if (step.kind === "choose") {
    const correct = String(response ?? "").trim().toLowerCase() === String(step.answer ?? "").trim().toLowerCase();
    return { correct, score: correct ? 1 : 0, feedback: correct ? step.explanation : step.hint, feedbackEs: correct ? step.explanationEs : step.hintEs };
  }
  const text = String(response ?? "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  const requiredWords = (step.knowledgeIds || []).flatMap(() => []).length;
  const score = Math.min(1, words.length / (step.kind === "write" ? 12 : 8));
  return { correct: words.length >= (step.kind === "write" ? 6 : 4), score, wordCount: words.length, feedback: words.length >= 4 ? "Good start. Check that each sentence has a clear subject and verb." : step.hint, feedbackEs: words.length >= 4 ? "Buen comienzo. Comprueba que cada oración tenga un sujeto y un verbo claros." : step.hintEs, requiredWords };
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
  return { completedSteps: results.length, totalSteps: state?.unit?.steps?.length || 0, correctSteps: results.filter((item) => item.correct).length, skills: [...new Set(results.map((item) => item.skill))], knowledgeIds: [...new Set(results.flatMap((item) => item.knowledgeIds || []))] };
}

export { getIntegratedUnit, evaluateIntegratedStep, createIntegratedUnitState, submitIntegratedStep, advanceIntegratedStep, summarizeIntegratedUnit };
