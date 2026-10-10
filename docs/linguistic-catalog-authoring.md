# HODIE linguistic catalog: authoring and review

The linguistic catalog is data in `data/linguistic-catalog.json`, not UI copy embedded in `app.js`.

## Add vocabulary without changing JavaScript

Add an entry to `vocabularyEntries` with a stable unique `id`, `lemma`, `partOfSpeech`, CEFR `level`, `domain`, Spanish meaning, `forms`, `collocations` and `examples`. Unknown words are not automatically errors. A new profession can reuse the existing article rule when its domain and part of speech are classified correctly.

## Add a narrow data-driven correction

A rule may use a reviewed `matcher` object:

```json
{
  "id": "SPELL-EXAMPLE-001",
  "implementation": "catalog-regex",
  "level": "A2",
  "category": "spelling",
  "title": "Correct a reviewed spelling variant",
  "titleEs": "Corrige una variante ortográfica revisada",
  "explanation": "Use the standard spelling in this context.",
  "explanationEs": "Usa la ortografía estándar en este contexto.",
  "examples": ["I teach robotics."],
  "incorrect": ["I teach roboticks."],
  "severity": "medium",
  "priority": "medium",
  "status": "tested",
  "matcher": {
    "pattern": "\\broboticks\\b",
    "flags": "gi",
    "replacement": "robotics",
    "confidence": "high"
  }
}
```

The generic matcher supports reviewed JavaScript regular expressions and replacement strings. Keep patterns narrow, avoid context-dependent prepositions and broad rewrites, and include both positive and negative test cases in `testCases`. A pattern must not be marked `tested` until its expected correction and valid alternatives pass the suite.

## When a new JavaScript implementation is still required

Data-only matchers support narrow, deterministic patterns. Rules requiring syntax trees, long-distance agreement, semantic interpretation, pronunciation analysis, or ambiguity resolution need a dedicated implementation or a future parser/provider. Do not represent those abilities as if a regex could reliably solve them.

## Validation gate

Run `npm test`. The linguistic test suite checks unique IDs, required bilingual metadata, referenced rule IDs, valid matchers, expected corrections, and examples that must remain unchanged. Keep the status at `draft` until the rule has implementation and reviewed test coverage.


Matcher expressions are validated as regular expressions at catalog-validation time; keep the pattern narrow and review the negative cases before changing a rule to `tested`.
