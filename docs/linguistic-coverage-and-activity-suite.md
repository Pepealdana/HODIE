# HODIE linguistic coverage and activity suite

## Purpose

This is a local-first, deterministic learning environment. More content must improve retrieval, practice and transfer without turning unverified language patterns into automatic corrections.

## Current content snapshot

The expanded runtime catalog contains:

- **111 grammar and syntax records.** The 19 additions in this change are marked `draft` and `feedback-only`. They are searchable references, not automatic correction rules.
- **449 vocabulary entries** with lemma, part of speech, CEFR level, Spanish meaning, domain, forms, collocations, examples and search terms.
- **69 communicative functions** connected to Can-Do goals, structures, vocabulary domains and cross-skill transfer links.
- **119 linguistic regression cases**, including valid-sentence checks intended to detect false positives.
- **71 micro-practice activities** spanning choose, complete, order, match, listening, speaking and mini-production.
- **12 full content activities** spanning speaking, listening comprehension, reading comprehension, controlled practice, vocabulary recognition, guided writing, pronunciation, interaction and an integrated B1 writing task.

These are inventory counts, not a claim that every item has been externally reviewed or that every grammar point is automatically detected.

## Rule activation policy

A grammar record may be searchable before it is safe to use as a correction rule. Automatic correction requires all of the following:

1. A narrow, explainable pattern with known scope.
2. Positive examples that should be corrected.
3. Negative examples and valid alternatives that must remain unchanged.
4. A deterministic correction and bilingual explanation.
5. Regression tests in the full CI suite.
6. Explicit `status: tested` and `correctionPolicy: automatic-tested` only after review.

Draft records must remain available for explanation/search only. Vocabulary similarity is not proof of a grammar error. Ambiguous or speech-transcription-sensitive phrases must not be rewritten automatically.

## Learning cycle

`diagnose known pattern → explain → targeted micro-practice → retry → save attempt → schedule review → test transfer`

- The micro-practice bank provides short controlled and receptive activities.
- The full content library provides communicative tasks with observable criteria and retry contracts.
- The adaptive planner considers prior evidence, gaps, retention and activity availability. It should preserve a clear same-skill sequence when a prerequisite-backed path is available, while still allowing cross-skill practice.
- A single correct answer is evidence of one successful attempt, not proof of long-term mastery. Consolidation requires repeated evidence and later review.

## Cross-resource relationships

Communicative functions connect grammar structures, vocabulary domains, Can-Do goals and skill-transfer targets. Activity links combine Can-Do IDs, content tags, review targets, rule categories and vocabulary terms. Search results for draft rules are learning references; they must not be presented as confirmed diagnoses.

## Validation

Run `npm test`. The suite builds the linguistic catalog, tests the deterministic correction engine, validates the content model and activity types, checks knowledge links, and verifies that the new draft rules remain inactive for automatic correction.
