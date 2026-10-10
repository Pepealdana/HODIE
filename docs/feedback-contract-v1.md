# HODIE shared feedback contract v1

## Purpose

Normalize evaluation output from conversation, deterministic micro-practice, integrated-unit production, and future providers into one learner-facing feedback shape. This contract does not replace evaluators; it makes their output interoperable.

## Contract

- `contractVersion`: versioned shape.
- `activityId`, `surface`, `skill`: provenance and learning context.
- `responseProvided`, `status`: distinguish empty, objectively correct, needs work, partial, self-review, and unavailable results.
- `source`: answer key, deterministic rules, checklist, speech recognition, AI, or unknown.
- `strengths[]`: specific evidence of what worked.
- `corrections[]`: target, actual form, expected/corrected form, bilingual explanation, examples, priority and retry policy.
- `missing[]`: task criteria or checklist items not demonstrated.
- `nextAction`: one actionable next step, not a generic recommendation.
- `metrics`: word count, sentence count and optional internal score.
- `limits[]`: explicit limits such as checklist-only evaluation; no CEFR certification.

## Invariants

1. An empty response is never successful.
2. `correct: null` means self-review, not failure or correctness.
3. Only observed evidence is included; the normalizer does not invent a correction.
4. The learner sees no more than three corrections and five missing criteria.
5. Feedback-provider output cannot mutate progress or mastery; only the existing evidence boundary and learning engine can do so.
6. Activity-specific evaluators remain responsible for deciding correctness; the contract only normalizes their result.
7. Scores are optional internal signals and must not be presented as official CEFR levels.

## Current coverage and known limits

- Conversation: `src/experience-engine.js`, criteria plus a small deterministic grammar-rule set.
- Micro-practice: `src/micro-practice.js` and `src/error-engine.js`; answer-key checks, limited token checks, criteria, and deterministic grammar rules.
- Integrated writing/speaking: `src/integrated-unit.js`; guided checklist with `correct: null` for open production.
- Listening: currently uses a deterministic answer key after browser speech synthesis reads `audioText`; it checks selected answers, not the learner's ability to recognize speech independently of the displayed options.
- Profile: `src/learning-profile.js` stores bounded learning history and knowledge outcomes in the local profile; `src/error-memory.js` aggregates errors from `profile.evidence`. These use different evidence collections, so repeated-error memory is not yet guaranteed to include every error recorded in `knowledgeEvidence`.

This is a first interoperability contract. It does not yet wire every rendering path to the contract; that integration must be staged and tested separately.
