# HODIE linguistic coverage and activity suite

## Purpose

This is a local-first, deterministic learning environment. More content must improve retrieval, practice and transfer without turning unverified language patterns into automatic corrections.

## Current content snapshot

The expanded runtime catalog contains:

- **111 grammar and syntax records.** The 19 additions in this change are marked `draft` and `feedback-only`. They are searchable references, not automatic correction rules.
- **449 vocabulary entries** with lemma, part of speech, CEFR level, Spanish meaning, domain, forms, collocations, examples and search terms.
- **69 communicative functions** connected to Can-Do goals, structures, vocabulary domains and cross-skill transfer links.
- **119 linguistic regression cases**, including valid-sentence checks intended to detect false positives.
- **104 micro-practice activities** spanning choose, complete, order, match, listening, speaking and mini-production.
- **12 full content activities** spanning speaking, listening comprehension, reading comprehension, controlled practice, vocabulary recognition, guided writing, pronunciation, interaction and an integrated B1 writing task.
- **136 Can-Do goals**, including new A1 foundation goals for Reading, pronunciation and Communication.

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
- **Spiral learning is explicit:** A1 is not assumed to be mastered when a learner reaches A2 or B1. Review sessions can draw from the whole micro-practice bank and, when a session contains at least three activities, include at least one A1 retrieval task alongside later-level practice.
- Reading, pronunciation and Communication each have at least three microactivities at A1, A2 and B1. A2 includes extra practice to support consolidation and return visits.
- Pronunciation feedback is evidence-limited: the current speech path checks recognised key words, not detailed phonetic quality. It must not claim to score accent, individual sounds or prosody without appropriate evidence.
- A single correct answer is evidence of one successful attempt, not proof of long-term mastery. Consolidation requires repeated evidence and later review.

## Cross-resource relationships

Communicative functions connect grammar structures, vocabulary domains, Can-Do goals and skill-transfer targets. Activity links combine Can-Do IDs, content tags, review targets, rule categories and vocabulary terms. Search results for draft rules are learning references; they must not be presented as confirmed diagnoses.

## Validation

Run `npm test`. The suite builds the linguistic catalog, tests the deterministic correction engine, validates the content model and activity types, checks knowledge links, enforces A1/A2/B1 spiral coverage for Reading, pronunciation and Communication, verifies that review can retrieve A1 tasks at later stages, and keeps draft rules inactive for automatic correction.


## Visible activity catalogue integration

The practice home exposes a filterable catalogue for A1, A2 and B1 micro-practice with skill filters. Each result launches its selected activity by ID through the existing practice/evaluation/feedback/retry flow. Counts represent runnable micro-activities, not all full-content experiences or complete coverage of every Can-Do. Manual desktop and mobile verification is still required after deployment.


## Expanded activity bank (October 2026)

- The micro-practice library now targets at least eight activities per skill and level across A1, A2 and B1, using the eight HODIE skill strands and existing Can-Do links.
- Activity metadata distinguishes riddles, memory recall, timed challenges, error-detection and sequence tasks. The interface renders memory recall and countdown mechanics where the underlying response type supports deterministic evaluation.
- A dedicated Reported Speech home shortcut opens the activity catalogue with the topic filter applied. The active A1/A2/B1 pack is available locally; B2 remains separate behind the evidence-based unlock gate.
- The complete activity library includes level-specific tasks for all eight skills. This supplements, rather than replaces, the micro-practice bank.
- This is CEFR-informed learning content, not an official CEFR assessment or certification.

- Every micro-activity links to a Can-Do at the same CEFR level and skill. A1 foundational Can-Dos are explicit; Reported Speech has separate writing Can-Dos for A2 and B1 instead of incorrectly linking writing tasks to communication targets.
