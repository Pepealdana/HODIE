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
