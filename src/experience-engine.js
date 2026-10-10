import { evaluateCriteria, prioritizeErrors, createError } from "./error-engine.js";

const EXPERIENCE_KINDS = new Set(["conversation", "simulation"]);
const EXPERIENCE_MODES = new Set(["guided-open", "role-play", "presentation"]);

function getExperience(library, id) {
  return (library?.experiences || []).find((item) => item.id === id) || null;
}

function validateExperience(experience) {
  if (!experience?.id) throw new Error("Experience must have an id.");
  if (!EXPERIENCE_KINDS.has(experience.kind)) throw new Error(`Unsupported experience kind: ${experience.kind}`);
  if (!EXPERIENCE_MODES.has(experience.mode)) throw new Error(`Unsupported experience mode: ${experience.mode}`);
  if (!Array.isArray(experience.stages) || !experience.stages.length) throw new Error("Experience must have at least one stage.");
  return true;
}

function selectExperiences(library, { kind = null, level = null, context = null } = {}) {
  return (library?.experiences || []).filter((experience) => {
    if (kind && experience.kind !== kind) return false;
    if (level && !experience.levels?.includes(level)) return false;
    if (context && !experience.contexts?.includes(context)) return false;
    return true;
  });
}

function createExperienceSession(library, id, options = {}) {
  const experience = getExperience(library, id);
  validateExperience(experience);
  return {
    id: options.sessionId || `experience-${id}-${Date.now()}`,
    experienceId: id,
    kind: experience.kind,
    mode: experience.mode,
    index: 0,
    responses: [],
    corrections: [],
    state: "started",
    startedAt: options.now || new Date().toISOString()
  };
}

function buildLanguageNotes(experience, stage, text) {
  const rules = [
    {
      id: "job-article",
      pattern: /\bI\s+am\s+(technology teacher|English teacher|teacher|student|programmer|developer|engineer|professor)\b/i,
      replacement: (match, job) => `I am a ${job.toLowerCase()}`,
      message: 'Use "a/an" before a singular job or role.',
      messageEs: 'Usa "a/an" antes de una profesión o un rol en singular.',
      examples: ["I am a teacher.", "I am an engineer."]
    },
    {
      id: "enjoy-ing",
      pattern: /\bI\s+enjoy\s+to\s+([a-z]+)\b/i,
      replacement: (match, verb) => `I enjoy ${verb.toLowerCase()}ing`,
      message: 'After "enjoy", use a verb ending in -ing.',
      messageEs: 'Después de "enjoy", usa un verbo terminado en -ing.',
      examples: ["I enjoy reading.", "I enjoy building robots."]
    },
    {
      id: "work-place",
      pattern: /\bI\s+work\s+on\s+a\s+(school|company|office)\b/i,
      replacement: (match, place) => `I work at a ${place.toLowerCase()}`,
      message: 'For the place where you work, "work at a school/company/office" is usually more natural.',
      messageEs: 'Para indicar el lugar donde trabajas, normalmente es más natural decir "work at a school/company/office".',
      examples: ["I work at a school.", "I work at an office."]
    },
    {
      id: "third-person-s",
      pattern: /\b(he|she|it)\s+(work|teach|enjoy|like|build)\b/i,
      replacement: (match, subject, verb) => `${subject} ${verb.toLowerCase()}s`,
      message: 'In the present simple, he/she/it usually needs -s on the verb.',
      messageEs: 'En presente simple, normalmente añadimos -s al verbo con he/she/it.',
      examples: ["She teaches robotics.", "He works at a school."]
    }
  ];

  rules.push(
    {
      id: "compound-job-connector",
      pattern: /\\b(a\\s+technology)\\s+an\\s+(robotics\\s+teacher)\\b/i,
      replacement: (match, first, second) => `${first} and ${second}`,
      message: 'Use "and" to join the two parts of this job title; do not repeat the article here.',
      messageEs: 'Usa "and" para unir las dos partes de esta profesión; no repitas el artículo en esta estructura.',
      examples: ["I am a technology and robotics teacher."]
    },
    {
      id: "plural-subject-agreement",
      pattern: /\\b(my students|the students|students)\\s+(is|has|does|works|teaches|builds|uses)\\b/i,
      replacement: (match, subject, verb) => {
        const pluralVerb = { is: "are", has: "have", does: "do", works: "work", teaches: "teach", builds: "build", uses: "use" };
        return `${subject} ${pluralVerb[verb.toLowerCase()] || verb.toLowerCase()}`;
      },
      message: 'A plural subject such as "students" needs a plural verb form.',
      messageEs: 'Un sujeto plural como "students" necesita la forma plural del verbo.',
      examples: ["My students are creative.", "The students build a robot."]
    },
    {
      id: "singular-subject-agreement",
      pattern: /\\b(the robot|a robot|my school|the school)\\s+(build|use|have|are|do|work|teach)\\b/i,
      replacement: (match, subject, verb) => {
        const singularVerb = { build: "builds", use: "uses", have: "has", are: "is", do: "does", work: "works", teach: "teaches" };
        return `${subject} ${singularVerb[verb.toLowerCase()] || verb.toLowerCase()}`;
      },
      message: 'A singular subject such as "the robot" usually needs the third-person present form.',
      messageEs: 'Un sujeto singular como "the robot" normalmente necesita la forma de tercera persona en presente.',
      examples: ["The robot uses a sensor.", "My school teaches robotics."]
    },
    {
      id: "repeated-connector",
      pattern: /\\b(and|but|because|so)\\s+\\1\\b/i,
      replacement: (match, connector) => connector.toLowerCase(),
      message: 'Avoid repeating the same connector twice in a row.',
      messageEs: 'Evita repetir el mismo conector dos veces seguidas.',
      examples: ["I teach robotics and I enjoy it.", "I like English because it helps me."]
    }
  );

  const notes = [];
  let corrected = text;
  for (const rule of rules) {
    const match = corrected.match(rule.pattern);
    if (!match) continue;
    const replacement = rule.replacement(...match);
    const next = corrected.replace(rule.pattern, replacement);
    notes.push(createError({
      activity: { id: `${experience.id}-${stage.id}`, context: experience.contexts?.[0] || "general" },
      type: "grammar",
      target: rule.id,
      actual: match[0],
      expected: replacement,
      severity: "low",
      priority: "low",
      message: rule.message,
      messageEs: rule.messageEs,
      correction: next,
      examples: rule.examples,
      retry: false
    }));
    corrected = next;
    if (notes.length >= 2) break;
  }
  return { notes: prioritizeErrors(notes, 2), correctedText: corrected };
}

function buildNextStep({ text, matched, missing, languageNotes, wordCount, sentenceCount }) {
  if (languageNotes.length) {
    return {
      title: "Practise one language improvement",
      titleEs: "Practica una mejora de inglés",
      instruction: "Read the suggested correction aloud, then make one new sentence with the same pattern.",
      instructionEs: "Lee en voz alta la corrección sugerida y crea otra frase usando el mismo patrón."
    };
  }
  if (missing.length) {
    return {
      title: "Answer the question more directly",
      titleEs: "Responde de forma más directa",
      instruction: `Add one detail about: ${missing[0].label || missing[0].id}.`,
      instructionEs: `Añade un detalle sobre: ${missing[0].label || missing[0].id}.`
    };
  }
  if (wordCount < 9 || sentenceCount < 2) {
    return {
      title: "Extend your answer",
      titleEs: "Amplía tu respuesta",
      instruction: "Add one more sentence with a reason or example. Try using because, for example, or also.",
      instructionEs: "Añade otra oración con una razón o un ejemplo. Prueba con because (porque), for example (por ejemplo) o also (también)."
    };
  }
  if (!/\b(because|so|but|and|also|for example)\b/i.test(text)) {
    return {
      title: "Connect your ideas",
      titleEs: "Conecta tus ideas",
      instruction: "Try connecting two ideas with and, but, or because.",
      instructionEs: "Intenta conectar dos ideas con and, but o because."
    };
  }
  return {
    title: "Make it more specific",
    titleEs: "Sé más específico",
    instruction: "Add one concrete example from your work, a class, or a robotics project.",
    instructionEs: "Añade un ejemplo concreto de tu trabajo, una clase o un proyecto de robótica."
  };
}

function evaluateExperienceTurn(experience, stage, response) {
  const text = String(response ?? "").trim();
  const criteria = evaluateCriteria(stage.criteria || [], text);
  const matched = criteria.filter((item) => item.matched);
  const missing = criteria.filter((item) => !item.matched);
  const responseProvided = text.length > 0;
  if (!responseProvided) {
    return {
      responseProvided: false,
      criteria,
      matched,
      missing,
      strengths: [],
      errors: [],
      corrections: [],
      languageNotes: [],
      correctedText: text,
      wordCount: 0,
      sentenceCount: 0,
      score: 0,
      canContinue: false,
      retryRecommended: true,
      nextStep: null,
      feedbackStatus: "empty"
    };
  }

  const { notes: languageNotes, correctedText } = buildLanguageNotes(experience, stage, text);
  const words = text.match(/[\p{L}\p{N}’'-]+/gu) || [];
  const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const strengths = matched.map((item) => ({
    id: item.id,
    label: item.label || item.id,
    message: `You addressed the goal: ${item.label || item.id}.`,
    messageEs: `Respondiste al objetivo: ${item.label || item.id}.`
  }));
  if (wordCount >= 8) {
    strengths.push({
      id: "detail",
      label: "Developed answer",
      message: "You gave enough words to develop an idea.",
      messageEs: "Usaste suficientes palabras para desarrollar una idea."
    });
  }
  if (sentenceCount >= 2) {
    strengths.push({
      id: "sentences",
      label: "More than one sentence",
      message: "You connected your response across multiple sentences.",
      messageEs: "Desarrollaste la respuesta en varias oraciones."
    });
  }
  if (/\b(and|but|because|so|also|for example)\b/i.test(text)) {
    strengths.push({
      id: "connector",
      label: "Connected ideas",
      message: "You used a connector to relate ideas.",
      messageEs: "Usaste un conector para relacionar ideas."
    });
  }

  const errors = [];
  for (const item of missing) {
    errors.push(createError({
      activity: { id: `${experience.id}-${stage.id}`, context: experience.contexts?.[0] || "general" },
      type: "task-completion",
      target: item.id,
      severity: "low",
      priority: "low",
      message: item.missingMessage || "Try to include this idea.",
      messageEs: item.missingMessageEs || "Intenta incluir esta idea.",
      retry: false
    }));
  }
  const nextStep = buildNextStep({ text, matched, missing, languageNotes, wordCount, sentenceCount });
  const score = Math.min(1, 0.55 + (matched.length / Math.max(1, criteria.length)) * 0.3 + (wordCount >= 8 ? 0.1 : 0) + (sentenceCount >= 2 ? 0.05 : 0));

  return {
    responseProvided,
    criteria,
    matched,
    missing,
    strengths: strengths.slice(0, 4),
    errors: prioritizeErrors([...errors, ...languageNotes], 3),
    corrections: languageNotes,
    languageNotes,
    correctedText,
    wordCount,
    sentenceCount,
    score,
    canContinue: true,
    retryRecommended: false,
    nextStep,
    feedbackStatus: languageNotes.length ? "language-note" : missing.length ? "task-focus" : "practice-guidance",
    feedbackLimit: "Rule-based feedback only. No automated language model or full CEFR judgement is used."
  };
}

function advanceExperienceSession(session, turnResult) {
  if (!session || session.state !== "started") throw new Error("Experience session is not active.");
  if (!turnResult?.canContinue) return { ...session };
  return {
    ...session,
    index: session.index + 1,
    responses: [...session.responses, turnResult],
    corrections: [...session.corrections, ...(turnResult.corrections || [])]
  };
}

function isExperienceComplete(experience, session) {
  return Boolean(session && session.index >= experience.stages.length);
}

function summarizeExperience(experience, session) {
  const turns = session.responses || [];
  const scores = turns.map((turn) => turn.score).filter((score) => Number.isFinite(score));
  const strengths = [...new Set(turns.flatMap((turn) => (turn.strengths || []).map((item) => item.label)))];
  const focusAreas = [...new Set(turns.flatMap((turn) => (turn.missing || []).map((item) => item.label || item.id)))];
  const practiceSteps = turns.map((turn, index) => ({
    turn: index + 1,
    title: turn.nextStep?.title || "Keep practising",
    titleEs: turn.nextStep?.titleEs || "Sigue practicando",
    instruction: turn.nextStep?.instruction || "",
    instructionEs: turn.nextStep?.instructionEs || ""
  }));
  return {
    experienceId: experience.id,
    turns: turns.length,
    totalTurns: experience.stages.length,
    averageScore: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0,
    corrections: session.corrections || [],
    strengths,
    focusAreas,
    practiceSteps,
    responses: turns.map((turn, index) => ({
      turn: index + 1,
      wordCount: turn.wordCount || 0,
      sentenceCount: turn.sentenceCount || 0,
      matched: (turn.matched || []).map((item) => item.label || item.id),
      missing: (turn.missing || []).map((item) => item.label || item.id),
      corrections: turn.corrections || [],
      nextStep: turn.nextStep || null
    })),
    completed: turns.length >= experience.stages.length
  };
}

export {
  EXPERIENCE_KINDS,
  EXPERIENCE_MODES,
  getExperience,
  validateExperience,
  selectExperiences,
  createExperienceSession,
  evaluateExperienceTurn,
  advanceExperienceSession,
  isExperienceComplete,
  summarizeExperience
};
