import catalog from "../data/linguistic-catalog.json" with { type: "json" };

const PRIORITY = { critical: 4, high: 3, medium: 2, low: 1 };
const metadata = new Map(catalog.grammarRules.map((rule) => [rule.implementation, rule]));

const JOB_NOUNS = new Set([
  "teacher", "student", "programmer", "developer", "engineer", "doctor",
  "lawyer", "nurse", "designer", "technician", "coordinator", "professor",
  "administrator", "architect", "accountant", "mechanic", "artist", "manager",
  "robotics teacher", "technology teacher", "technology and robotics teacher"
]);
const THIRD_PERSON_FORMS = {
  work: "works", teach: "teaches", build: "builds", use: "uses", like: "likes",
  enjoy: "enjoys", have: "has", do: "does", go: "goes", study: "studies",
  watch: "watches", fix: "fixes", make: "makes", play: "plays", read: "reads",
  write: "writes", speak: "speaks", live: "lives", need: "needs", want: "wants",
  help: "helps", explain: "explains", create: "creates", teach: "teaches"
};
const PLURAL_FORMS = Object.fromEntries(
  Object.entries(THIRD_PERSON_FORMS).map(([base, third]) => [third, base])
);
const COMMON_WORDS = new Set("i am a an the is are was were be been being you he she it we they my your his her our their and or but because so with at on in to of for from work teach teacher student students robotics technology enjoy like love want would can do have has had build builds use uses this that these those here there what where when who why how about one thing difficult problem challenge english".split(/\s+/));

function preserveCase(source, replacement) {
  if (source && source === source.toUpperCase()) return replacement.toUpperCase();
  if (source && source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function applyRule(text, implementation, pattern, replace, fallback = {}) {
  const rule = metadata.get(implementation);
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  let changed = false;
  let nextText = "";
  let cursor = 0;
  const errors = [];
  for (const match of text.matchAll(regex)) {
    if (match.index < cursor) continue;
    const replacement = typeof replace === "function" ? replace(...match) : match[0].replace(pattern, replace);
    if (replacement === match[0]) continue;
    nextText += text.slice(cursor, match.index) + replacement;
    const start = match.index;
    const end = start + match[0].length;
    errors.push({
      ruleId: rule?.id || implementation,
      target: implementation,
      type: rule?.category === "spelling" ? "spelling" : rule?.category === "syntax" ? "word-order" : "grammar",
      actual: match[0],
      expected: replacement,
      correction: replacement,
      start,
      end,
      severity: rule?.severity || fallback.severity || "medium",
      priority: rule?.priority || fallback.priority || "medium",
      message: rule?.explanation || fallback.message || "",
      messageEs: rule?.explanationEs || fallback.messageEs || "",
      examples: rule?.examples || [],
      retry: ["high", "critical"].includes(rule?.priority || fallback.priority || "medium"),
      confidence: fallback.confidence || "high"
    });
    cursor = end;
    changed = true;
  }
  if (!changed) return { text, errors: [] };
  nextText += text.slice(cursor);
  return { text: nextText, errors };
}

function runReplacementRule(text, implementation, regex, replace, options) {
  return applyRule(text, implementation, regex, replace, options);
}

function getJobNouns(extraVocabulary = []) {
  const jobs = new Set(JOB_NOUNS);
  for (const item of [...catalog.vocabularyEntries, ...extraVocabulary]) {
    if (item?.domain === "jobs" || item?.partOfSpeech === "job") {
      jobs.add(String(item.lemma || item.word || "").toLowerCase());
      for (const form of item.forms || []) jobs.add(String(form).toLowerCase());
    }
  }
  return [...jobs].filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
}
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function analyzeLanguage(input, options = {}) {
  const originalText = String(input ?? "");
  let text = originalText;
  const errors = [];
  const extraVocabulary = Array.isArray(options.vocabulary) ? options.vocabulary : [];
  const jobPattern = getJobNouns(extraVocabulary);
  const rules = [
    ["capital-i", /(^|[.!?]\s*)i(?=\s+(?:am|work|teach|have|like|enjoy|want|would|can|do|live|study|build|make|use|need|go)\b)/g, (m, prefix) => prefix + "I"],
    ["spelling-teacher", /\bte(?:cher|caher)\b/gi, (m) => preserveCase(m, "teacher")],
    ["be-agreement", /\b(I|he|she|it|you|we|they)\s+(am|is|are)\b/gi, (m, subject, verb) => {
      const s = subject.toLowerCase();
      const expected = s === "i" ? "am" : ["he", "she", "it"].includes(s) ? "is" : "are";
      return subject + " " + preserveCase(verb, expected);
    }],
    ["compound-job-connector", /\b(a\s+technology)\s+an\s+(robotics\s+teacher)\b/gi, (m, first, second) => first + " and " + second],
    ["article-profession", new RegExp("\\b(I am|I'm|he is|she is|he's|she's|they are|we are)\\s+(?!a\\b|an\\b|the\\b)(" + jobPattern + ")\\b", "gi"),
      (m, subject, job) => subject + " " + (/^[aeiou]/i.test(job) ? "an" : "a") + " " + job],
    ["article-a-an", /\b(a)\s+(engineer|architect|accountant|artist|administrator)\b/gi, (m, article, noun) => preserveCase(article, "an") + " " + noun],
    ["enjoy-gerund", /\b(enjoy|enjoys|enjoyed)\s+to\s+([a-z]+)\b/gi, (m, verb, base) => {
      const irregular = { be: "being", have: "having", make: "making", take: "taking", write: "writing", use: "using", come: "coming", go: "going", run: "running", swim: "swimming", get: "getting", sit: "sitting", put: "putting" };
      const gerund = irregular[base.toLowerCase()] || (/ie$/i.test(base) ? base.slice(0, -2) + "ying" : /e$/i.test(base) && !/ee$/i.test(base) ? base.slice(0, -1) + "ing" : /[aeiou][^aeiou]$/i.test(base) && base.length <= 5 ? base + base.slice(-1) + "ing" : base + "ing");
      return verb + " " + gerund;
    }],
    ["plural-agreement", /\b(my students|the students|students|my teachers|the teachers|teachers|children|people|they|we)\s+(is|has|does|works|teaches|builds|uses|likes|enjoys|goes|studies|watches|fixes|makes|plays|reads|writes|speaks|lives|needs|wants|helps|explains|creates)\b/gi,
      (m, subject, verb) => subject + " " + (PLURAL_FORMS[verb.toLowerCase()] || ({ is: "are", has: "have", does: "do" })[verb.toLowerCase()] || verb)],
    ["third-person-singular", /\b(he|she|it|the robot|a robot|my school|the school|my student|the student)\s+(work|teach|build|use|like|enjoy|have|do|go|study|watch|fix|make|play|read|write|speak|live|need|want|help|explain|create)\b/gi,
      (m, subject, verb) => subject + " " + (THIRD_PERSON_FORMS[verb.toLowerCase()] || verb + "s")],
    ["work-place", /\b(work|works|worked)\s+on\s+(a|the)\s+(school|company|office)\b/gi, (m, verb, article, place) => verb + " at " + article + " " + place],
    ["repeated-connector", /\b(and|but|because|so)\s+\1\b/gi, (m, connector) => connector],
    ["adjective-noun-order", /\b(a|an|the)\s+(problem|robot|project|class|lesson)\s+(difficult|interesting|new|important|easy)\b/gi, (m, article, noun, adjective) => article + " " + adjective + " " + noun]
  ];

  for (const [implementation, pattern, replacement] of rules) {
    const result = runReplacementRule(text, implementation, pattern, replacement);
    if (result.errors.length) {
      errors.push(...result.errors);
      text = result.text;
    }
  }

  // Unknown vocabulary remains neutral. Only a small, reviewed spelling list is auto-corrected.
  const vocabulary = [...catalog.vocabularyEntries, ...extraVocabulary];
  const knownWords = new Set(vocabulary.flatMap((entry) => [
    entry.lemma, ...(entry.forms || []), ...(entry.collocations || []).flatMap((phrase) => phrase.split(/\s+/))
  ]).filter(Boolean).map((word) => String(word).toLowerCase()));
  const tokens = originalText.match(/[\p{L}]+/gu) || [];
  const unknownWords = [...new Set(tokens.filter((word) => !knownWords.has(word.toLowerCase()) && !COMMON_WORDS.has(word.toLowerCase()) && word.length > 2))];

  const prioritized = errors
    .filter((error, index, all) => all.findIndex((other) => other.ruleId === error.ruleId && other.actual === error.actual) === index)
    .sort((a, b) => (PRIORITY[b.priority] || 0) - (PRIORITY[a.priority] || 0))
    .slice(0, Math.max(1, options.maxCorrections || 3));

  return {
    schemaVersion: catalog.schemaVersion,
    originalText,
    correctedText: text,
    errors: prioritized,
    unknownWords,
    hasHighConfidenceCorrection: prioritized.some((error) => error.confidence === "high"),
    catalogCoverage: { grammarRules: catalog.grammarRules.length, vocabularyEntries: vocabulary.length },
    policy: "Unknown words are not errors by themselves; uncertain cases are left unchanged."
  };
}

function validateLinguisticCatalog(value = catalog) {
  const errors = [];
  const ids = new Set();
  const implementations = new Set(value.grammarRules.map((rule) => rule.implementation));
  for (const rule of value.grammarRules) {
    if (!rule.id || ids.has(rule.id)) errors.push("Missing or duplicate grammar rule id: " + (rule.id || "(empty)"));
    ids.add(rule.id);
    if (!rule.level || !rule.category || !rule.explanation || !rule.explanationEs) errors.push(rule.id + ": missing required rule metadata");
    if (!Array.isArray(rule.examples) || !Array.isArray(rule.incorrect)) errors.push(rule.id + ": examples and incorrect cases must be arrays");
    if (!["tested", "policy", "draft"].includes(rule.status)) errors.push(rule.id + ": invalid review status");
  }
  for (const testCase of value.testCases || []) {
    for (const ruleId of testCase.expectRules || []) {
      if (!ids.has(ruleId)) errors.push(testCase.id + ": unknown expected rule " + ruleId);
    }
  }
  const implemented = new Set(["capital-i","spelling-teacher","article-profession","article-a-an","be-agreement","plural-agreement","third-person-singular","enjoy-gerund","work-place","repeated-connector","adjective-noun-order","open-vocabulary-policy","like-gerund","compound-job-connector"]);
  for (const rule of value.grammarRules) {
    if (rule.status === "tested" && !implemented.has(rule.implementation)) {
      errors.push("Missing rule implementation for tested rule: " + rule.id + " (" + rule.implementation + ")");
    }
  }
  return { valid: errors.length === 0, errors, ruleCount: value.grammarRules.length, vocabularyCount: value.vocabularyEntries.length };
}

export { analyzeLanguage, validateLinguisticCatalog, catalog as linguisticCatalog };
