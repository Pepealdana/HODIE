# HODIE Linguistic Library

## Source of truth
- `data/linguistic-catalog.json` is the runtime catalog imported by the engine.
- `data/linguistic-packs/*.json` are versioned authoring packs grouped by level or domain.
- `scripts/build-linguistic-catalog.js` merges records by stable ID. Repeated builds are idempotent; a matching ID updates its record.
- `schemas/linguistic-pack.schema.json` documents the data contract.

## Suggested organization
Use packs such as `a1-foundations`, `a2-daily-communication`, `b1-independent-user`, `b2-argumentation`, plus domain packs such as `technology-robotics`, `work-education`, `travel-daily-life`, `pronunciation-listening`, and `writing-mediation`. Level and domain are metadata, not mutually exclusive folders: one record can link to a Can-Do, several skills and multiple domains.

## Rule lifecycle
1. `draft`: inventory/backlog only; never executed by the engine.
2. `reviewed`: language checked; implementation/tests may still be missing.
3. `tested`: dedicated implementation and positive/negative regression cases pass.
4. `active`: eligible for learner-facing correction after review.
5. `deprecated`: kept for history, not offered to the engine.

Expansion pack 01 adds a broad planned grammar inventory. These records are deliberately drafts, not automatic corrections. Never change a draft to tested to inflate coverage. Unknown words are not errors by themselves, and valid variants must be represented in negative tests.

## Add a pack
Create a JSON file in `data/linguistic-packs/` with arrays `communicativeFunctions`, `grammarRules`, `vocabularyEntries`, and `testCases`; give each item a stable ID, bilingual explanations and level/domain metadata. Run `npm run build:linguistic-catalog` and `npm test`. Review false positives and false negatives before activating rules.

The catalog is a growing structured corpus, not a claim of complete CEFR coverage or official certification.


## Coverage pack 02: effective CEFR coverage

`data/linguistic-packs/coverage-2026-02.json` is the current focused expansion pack. It adds A1–A2 corrections for a limited set of regular plural nouns, singular `there is`, `does` questions, modal + base verb, `did` questions and present-continuous verb forms. It also adds essential vocabulary and bilingual practice prompts. These patterns are intentionally narrow; they are not a general-purpose parser.

The pack also completes contrastive instructional records for basic questions, time/place prepositions, object and subject pronouns, articles, present perfect, the passive, indirect questions, the first conditional, connectors and B2 cohesion/argumentation. Records without a dedicated correction pattern remain `draft`; examples and activities do not by themselves make a rule executable.

## Activity linkage and verification

- `src/linguistic-activity-links.js` resolves an activity's Can-Do ID to communicative functions, related grammar rules, vocabulary and skills.
- Conversation/writing review and micro-practice return this linkage as `linguisticLinks`. Rule-based errors keep stable rule IDs so the existing feedback/error-memory path can associate attempts with the same target.
- The service worker caches the linkage module and uses a new shell version after the runtime change.
- The activity-coverage test audits all content-library activities, micro-practice activities and representative conversation, writing, listening and reading surfaces. A successful audit means every audited activity has a direct Can-Do link; it does not mean every rule has been implemented for automatic correction.

Pack precedence is chronological by the YYYY-MM suffix in the pack filename: later packs override earlier records with the same stable ID. This allows the expansion inventory to remain the base while a later pack adds reviewed examples, exceptions, negative cases and practice.

Run:

```sh
npm run build:linguistic-catalog
npm test
```

The test suite verifies deterministic corrections and examples that must remain unchanged. The current implementation is still partial CEFR coverage; the remaining A1/A2 rules and B1/B2 complex structures should be implemented only after their own exceptions and contrastive cases are approved.
