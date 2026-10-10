import { buildFeedback, createError, evaluateCriteria, normalizeErrors, prioritizeErrors } from "./error-engine.js";

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.!?,]/g, "")
    .replace(/\s+/g, " ");

const MODE_CONFIG = {
  mixed: { label: "Mixed", kind: "mode" },
  review: { label: "Review", kind: "mode" },
  speaking: { label: "Speaking", kind: "skill", skill: "speaking" },
  listening: { label: "Listening", kind: "skill", skill: "listening" },
  reading: { label: "Reading", kind: "skill", skill: "reading" },
  writing: { label: "Writing", kind: "skill", skill: "writing" },
  grammar: { label: "Grammar", kind: "resource", resource: "grammar" },
  vocabulary: { label: "Vocabulary", kind: "resource", resource: "vocabulary" },
  pronunciation: { label: "Pronunciation", kind: "resource", resource: "pronunciation" }
};

const MIXED_SKILL_ORDER = ["speaking", "listening", "vocabulary", "grammar", "reading", "writing"];

function activityMatchesFocus(activity, config) {
  if (!config) return false;

  if (config.kind === "skill") {
    if (config.skill === "speaking") return activity.skill === "speaking" && ["speak", "mini-production"].includes(activity.type);
    if (config.skill === "listening") return activity.type === "listening";
    if (config.skill === "writing") return activity.skill === "writing" && activity.type === "mini-production";
    if (config.skill === "reading") return activity.skill === "reading" && activity.type !== "mini-production";
    return activity.skill === config.skill;
  }

  if (config.kind === "resource") {
    const matchesResource =
      activity.resources?.includes(config.resource) ||
      activity.languageResource === config.resource ||
      activity.skill === config.resource;

    if (!matchesResource) return false;

    if (config.resource === "grammar" || config.resource === "vocabulary") {
      return ["choose", "complete", "order", "match"].includes(activity.type);
    }

    return true;
  }

  return true;
}

function detectLanguageCorrections(activity, response) {
  if (!response || typeof response !== "string") return [];

  const rules = [
    {
      pattern: /\bte(?:cher|caher)\b/i,
      replacement: "teacher",
      target: "spelling-teacher",
      message: 'The correct spelling is "teacher".',
      messageEs: 'La escritura correcta es "teacher" (profesor/a).',
      examples: ["I am a teacher."]
    },
    {
      pattern: /(^|[.!?]\s*)i(?=\s+(?:am|work|teach|have|like|enjoy|want|would|can|do)\b)/gi,
      replacement: "$1I",
      target: "capital-i",
      message: 'The pronoun "I" is always capitalized in English.',
      messageEs: 'El pronombre "I" siempre se escribe con mayúscula en inglés.',
      examples: ["I am a teacher.", "I enjoy teaching."]
    },
    {
      pattern: /\bI\s+am\s+(?!a\b|an\b)(technology\s+and\s+robotics\s+teacher|technology\s+teacher|robotics\s+teacher|teacher|student|programmer|developer|engineer|professor)\b/i,
      replacement: (_match, job) => "I am " + (/^engineer$/i.test(job) ? "an" : "a") + " " + job.toLowerCase(),
      target: "article",
      message: 'Use "a/an" before a singular job or role.',
      messageEs: 'Usa "a/an" antes de una profesión o un rol en singular.',
      examples: ["I am a teacher.", "I am an engineer.", "I am a technology teacher."]
    },
    {
      pattern: /\bI\s+am\s+a\s+(engineer)\b/i,
      replacement: "I am an $1",
      target: "article-choice",
      message: 'Use "an" before "engineer" because it begins with a vowel sound.',
      messageEs: 'Usa "an" antes de "engineer" porque comienza con sonido vocálico.',
      examples: ["I am an engineer."]
    },
    {
      pattern: /\bI\s+work\s+on\s+a\s+(school|company|office)\b/i,
      replacement: "I work at a $1",
      target: "work-place",
      message: 'For a workplace such as a school, "work at" is a natural choice.',
      messageEs: 'Para un lugar de trabajo como una escuela, "work at" es una opción natural.',
      examples: ["I work at a school.", "I work at an office."]
    },
    {
      pattern: /\bI\s+enjoy\s+to\s+(build|teach|read|make|work|learn)\b/i,
      replacement: (_match, verb) => "I enjoy " + ({ build: "building", teach: "teaching", read: "reading", make: "making", work: "working", learn: "learning" })[verb.toLowerCase()],
      target: "enjoy-ing",
      message: 'After "enjoy", use a verb with -ing.',
      messageEs: 'Después de "enjoy", usamos el verbo con -ing.',
      examples: ["I enjoy reading.", "I enjoy building robots."]
    },
    {
      pattern: /\b(my students|the students|students)\s+(is|has|does|works|teaches|builds|uses)\b/i,
      replacement: (_match, subject, verb) => subject + " " + ({ is: "are", has: "have", does: "do", works: "work", teaches: "teach", builds: "build", uses: "use" })[verb.toLowerCase()],
      target: "plural-agreement",
      message: 'A plural subject such as "students" needs a plural verb form.',
      messageEs: 'Un sujeto plural como "students" necesita la forma plural del verbo.',
      examples: ["My students are creative.", "The students build a robot."]
    },
    {
      pattern: /\b(the robot|a robot|my school|the school)\s+(build|use|have|are|do|work|teach)\b/i,
      replacement: (_match, subject, verb) => subject + " " + ({ build: "builds", use: "uses", have: "has", are: "is", do: "does", work: "works", teach: "teaches" })[verb.toLowerCase()],
      target: "singular-agreement",
      message: 'A singular subject such as "the robot" usually needs the third-person present form.',
      messageEs: 'Un sujeto singular como "the robot" normalmente necesita la forma de tercera persona en presente.',
      examples: ["The robot uses a sensor.", "My school teaches robotics."]
    }
  ];

  let corrected = response;
  const errors = [];

  for (const rule of rules) {
    const match = corrected.match(rule.pattern);
    if (!match) continue;
    const next = corrected.replace(rule.pattern, rule.replacement);
    if (next === corrected) continue;

    errors.push(createError({
      activity,
      type: "grammar",
      target: rule.target,
      actual: match[0],
      expected: next,
      severity: "low",
      priority: "low",
      message: rule.message,
      messageEs: rule.messageEs,
      correction: match[0].replace(rule.pattern, rule.replacement),
      examples: rule.examples,
      retry: false
    }));
    corrected = next;
    if (errors.length >= 3) break;
  }

  if (!errors.length) return [];
  errors[0].correctedText = corrected;
  return errors;
}

function rankMixed(activity) {
  const skill = activity.primarySkill || activity.skill;
  const skillIndex = MIXED_SKILL_ORDER.indexOf(skill);
  const typeOrder = ["speak", "listening", "choose", "complete", "match", "order", "mini-production"];
  const typeIndex = typeOrder.indexOf(activity.type);
  return (skillIndex < 0 ? 20 : skillIndex) * 10 + (typeIndex < 0 ? 20 : typeIndex);
}

function selectMixed(activities, limit, mini) {
  const pool = activities.filter((item) => item.type !== "mini-production");
  const selected = [];
  const usedSkills = new Set();

  for (const skill of MIXED_SKILL_ORDER) {
    const candidate = pool.find((item) => {
      const itemSkill = item.primarySkill || item.skill;
      return itemSkill === skill && !usedSkills.has(itemSkill);
    });
    if (candidate) {
      selected.push(candidate);
      usedSkills.add(skill);
    }
    if (selected.length >= Math.max(1, limit - (mini ? 1 : 0))) break;
  }

  if (selected.length < Math.max(1, limit - (mini ? 1 : 0))) {
    const remaining = [...pool]
      .filter((item) => !selected.some((chosen) => chosen.id === item.id))
      .sort((a, b) => rankMixed(a) - rankMixed(b));

    for (const item of remaining) {
      selected.push(item);
      if (selected.length >= Math.max(1, limit - (mini ? 1 : 0))) break;
    }
  }

  if (mini && selected.length < limit) selected.push(mini);
  return selected.slice(0, limit);
}

function getReviewSignals(profile = {}) {
  const evidence = [...(profile.evidence || [])].reverse();
  const errors = evidence.flatMap((item) => item.errors || []).slice(0, 12);
  const weakDimensions = evidence
    .flatMap((item) => Object.entries(item.dimensions || {}).map(([dimension, score]) => ({ dimension, score })))
    .filter((item) => item.score < 0.65)
    .slice(0, 8);
  const due = (profile.reviews || []).filter((item) => item.nextReviewAt && new Date(item.nextReviewAt) <= new Date());

  return { errors, weakDimensions, due };
}

function selectReviewActivities(activities, limit, profile = {}, mini = null) {
  const { errors, weakDimensions, due } = getReviewSignals(profile);
  const errorTargets = new Set(errors.map((error) => String(error.target || "").toLowerCase()).filter(Boolean));
  const errorTypes = new Set(errors.map((error) => String(error.type || "").toLowerCase()));
  const weakTypes = new Set(weakDimensions.map((item) => String(item.dimension).toLowerCase()));

  const scored = activities
    .filter((item) => item.type !== "mini-production")
    .map((item) => {
      const targets = (item.reviewTargets || []).map((value) => String(value).toLowerCase());
      let score = 0;
      if (targets.some((target) => errorTargets.has(target))) score += 6;
      if (errorTypes.has(String(item.skill || "").toLowerCase())) score += 3;
      if (weakTypes.has(String(item.skill || "").toLowerCase())) score += 2;
      if (due.some((review) => review.canDoId === item.canDoId)) score += 2;
      if (item.reviewPriority === "high") score += 1;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score || rankMixed(a.item) - rankMixed(b.item));

  const targetCount = Math.max(1, limit - (mini ? 1 : 0));
  const selected = scored.slice(0, targetCount).map((entry) => entry.item);

  if (mini && selected.length < limit) selected.push(mini);
  return selected.slice(0, limit);
}

function selectMicroActivities(
  library,
  { canDoId, mode = "mixed", limit = 6, profile = {} } = {}
) {
  const activities = (library.activities || []).filter(
    (item) => !canDoId || item.canDoId === canDoId
  );
  if (!activities.length) return [];

  const config = MODE_CONFIG[mode] || MODE_CONFIG.mixed;
  const mini = activities.find((item) => item.type === "mini-production");

  if (mode === "mixed") return selectMixed(activities, limit, mini);
  if (mode === "review") return selectReviewActivities(activities, limit, profile, mini);

  const filtered = activities.filter((item) => activityMatchesFocus(item, config));
  const ordered = [...filtered].sort((a, b) => rankMixed(a) - rankMixed(b));

  // Focused modes remain faithful to their category.
  // Never substitute a Speaking production task into Listening, Grammar, etc.
  // If content is not available yet, return [] so the UI can explain it.
  return ordered.slice(0, limit);
}

function evaluateMicroActivity(activity, response) {
  const value = normalize(response);
  let result;

  if (["choose", "complete", "match", "listening"].includes(activity.type)) {
    const accepted = [activity.answer, ...(activity.acceptableAnswers || [])].map(normalize);
    const correct = accepted.includes(value);
    const errors = correct
      ? []
      : [createError({
          activity,
          type: activity.errorType || activity.skill || "grammar",
          target: activity.errorTarget || activity.answer,
          actual: response,
          expected: activity.answer,
          severity: activity.errorSeverity || "high",
          priority: activity.errorPriority || "high",
          message: activity.feedback?.incorrect || "Try again.",
          messageEs: activity.feedback?.incorrectEs || "Inténtalo de nuevo.",
          correction: activity.answer,
          retry: true
        })];

    result = {
      correct,
      score: correct ? 1 : 0,
      retryRecommended: !correct,
      feedback: correct ? activity.feedback?.correct : activity.feedback?.incorrect,
      feedbackEs: correct ? activity.feedback?.correctEs : activity.feedback?.incorrectEs,
      errors
    };
  } else if (activity.type === "order") {
    const submitted = Array.isArray(response)
      ? response.map(normalize)
      : value.split("|").map(normalize);
    const expected = activity.answer.map(normalize);
    const correct =
      submitted.length === expected.length &&
      submitted.every((item, index) => item === expected[index]);

    result = {
      correct,
      score: correct ? 1 : 0,
      retryRecommended: !correct,
      feedback: correct ? activity.feedback?.correct : activity.feedback?.incorrect,
      feedbackEs: correct ? activity.feedback?.correctEs : activity.feedback?.incorrectEs,
      errors: correct
        ? []
        : [createError({
            activity,
            type: "word-order",
            target: activity.errorTarget || "sentence-order",
            actual: submitted.join(" "),
            expected: expected.join(" "),
            severity: "high",
            priority: "high",
            message: activity.feedback?.incorrect || "Check the word order.",
            messageEs: activity.feedback?.incorrectEs || "Revisa el orden de las palabras.",
            correction: expected.join(" "),
            retry: true
          })]
    };
  } else if (activity.type === "speak") {
    const tokens = activity.requiredTokens || [];
    const heardWords = value.match(/[\p{L}\p{N}’'-]+/gu) || [];
    const exactMatch = (token) => {
      const normalizedWords = normalize(token).split(" ");
      if (normalizedWords.length === 1) return heardWords.includes(normalizedWords[0]);
      return heardWords.join(" ").includes(normalizedWords.join(" "));
    };
    const nearMatch = (token) => {
      const normalized = normalize(token);
      if (normalized.length > 4 && normalized.endsWith("s")) {
        const heard = heardWords.find((word) => word === normalized.slice(0, -1));
        if (heard) return heard;
      }
      return null;
    };
    const missing = tokens.filter((token) => !exactMatch(token) && !nearMatch(token));
    const nearMatches = tokens.map((token) => ({ target: token, heard: nearMatch(token) })).filter((item) => item.heard);
    const correct = missing.length === 0 && nearMatches.length === 0;
    const score = correct ? 1 : missing.length === 0 ? 0.75 : missing.length < Math.ceil(tokens.length / 2) ? 0.5 : 0;

    const errors = missing.length
      ? [createError({
          activity,
          type: "communication",
          target: "required-information",
          actual: response,
          expected: tokens.join(", "),
          severity: "medium",
          priority: "medium",
          message: "Include the missing key word: " + missing.join(", ") + ".",
          messageEs: "Incluye la palabra clave que falta: " + missing.join(", ") + ".",
          correction: missing.join(", "),
          retry: true
        })]
      : nearMatches.map((item) => createError({
          activity,
          type: "pronunciation",
          target: "speech-near-match",
          actual: item.heard,
          expected: item.target,
          severity: "low",
          priority: "low",
          message: 'The transcript heard "' + item.heard + '" instead of "' + item.target + '". Try making the final sound clearer.',
          messageEs: 'La transcripción reconoció "' + item.heard + '" en lugar de "' + item.target + '". Intenta pronunciar con más claridad el sonido final.',
          correction: item.target + " (heard as " + item.heard + ")",
          retry: true
        }));

    result = {
      correct,
      score,
      retryRecommended: !correct,
      missing,
      feedback: correct ? activity.feedback?.correct : missing.length ? activity.feedback?.partial : "Almost there. Repeat the word and make its ending clearer.",
      feedbackEs: correct ? activity.feedback?.correctEs : missing.length ? activity.feedback?.partialEs : "Casi lo logras. Repite la palabra y pronuncia con más claridad su terminación.",
      errors
    };
  } else if (activity.type === "mini-production") {
    const criteria = evaluateCriteria(activity.evaluation?.criteria || [], response);
    const met = criteria.filter((criterion) => criterion.matched);
    const minimumCriteria = activity.evaluation?.minimumCriteria ?? criteria.length;
    const practiceMinimumCriteria = activity.evaluation?.practiceMinimumCriteria ?? minimumCriteria;
    const characterMinimum = activity.evaluation?.minimumResponseCharacters || 0;
    const enoughLength = value.length >= characterMinimum;
    const taskComplete = met.length >= minimumCriteria && enoughLength;
    const correct = met.length >= practiceMinimumCriteria && enoughLength;
    const errors = [];

    for (const criterion of criteria.filter((item) => !item.matched)) {
      errors.push(createError({
        activity,
        type: activity.evaluation?.errorType || "task-completion",
        target: criterion.id,
        actual: response,
        expected: criterion.label,
        severity: "high",
        priority: "high",
        message: criterion.missingMessage || "Add this information to complete the task.",
        messageEs: criterion.missingMessageEs || "Agrega esta información para completar la tarea.",
        retry: true
      }));
    }

    const languageErrors = detectLanguageCorrections(activity, response);
    errors.push(...languageErrors);

    if (!enoughLength) {
      errors.push(createError({
        activity,
        type: "task-completion",
        target: "minimum-task-response",
        actual: response,
        expected: `at least ${characterMinimum} characters`,
        severity: "medium",
        priority: "medium",
        message: activity.feedback?.short || "Add a little more information.",
        messageEs: activity.feedback?.shortEs || "Agrega un poco más de información.",
        retry: true
      }));
    }

    const score = criteria.length
      ? Math.min(1, met.length / criteria.length) * (enoughLength ? 1 : 0.85)
      : enoughLength ? 1 : 0.5;

    result = {
      correct,
      score,
      retryRecommended: !correct,
      criteria,
      taskComplete,
      languageErrors,
      feedback: correct ? activity.feedback?.ready : activity.feedback?.short,
      feedbackEs: correct ? activity.feedback?.readyEs : activity.feedback?.shortEs,
      errors
    };
  } else {
    throw new Error(`Unsupported micro-activity type: ${activity.type}`);
  }

  const feedback = buildFeedback(activity, result, result.errors || [], { maxPriorityCorrections: 3 });
  return {
    ...result,
    ...feedback,
    errors: normalizeErrors(result.errors || [])
  };
}

function getModeLabel(mode) {
  return MODE_CONFIG[mode]?.label || "Mixed";
}

export {
  MODE_CONFIG,
  normalize,
  selectMicroActivities,
  evaluateMicroActivity,
  getModeLabel
};
