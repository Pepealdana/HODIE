# HODIE local-first language coach architecture

## Objective

Build an English-learning coach that works offline and does not require a paid AI service. Its core should be predictable, testable and useful in everyday, social, travel, study and professional contexts—not only technology or robotics. An optional language-model provider may be added later, but core practice, progress and verified rule corrections must work without it.

## Runtime pipeline

1. **Input adapters** receive typed text or a speech-recognition transcript. The learner can inspect and edit a transcript before it is evaluated. Speech recognition is an input service, not proof that the transcript is accurate.
2. **Conservative text analysis** preserves the learner's original response and runs reviewed, deterministic rules. It does not infer that unknown words are errors and does not silently replace ambiguous words.
3. **Rule engine** applies narrow matchers from the versioned linguistic catalog. Morphological transforms are shared across rules so spelling behavior stays consistent. Only rules with tested status and regression coverage may auto-correct.
4. **Task evaluator** checks whether the response addresses the conversation prompt. Language correctness and task completion remain separate signals.
5. **Feedback contract** normalizes corrections, examples, optional natural alternatives, missing task requirements, evaluation scope and the next action. A natural alternative is a suggestion, not a replacement for the learner's intended meaning.
6. **Practice planner** selects a retry, a short contrast exercise or a spaced review based on the rule ID and local error history.
7. **Local learning profile** stores progress and recurring error evidence on the device. The core learning flow does not need a network connection.

## Rule data contract

A rule should have a stable ID, CEFR target, category, bilingual explanation, correct examples, incorrect examples, exceptions, negative cases, practice prompts, activity links, priority, status and—when executable—a narrowly scoped matcher. A matcher must document what it can safely correct and what it must leave unchanged.

Rule lifecycle:

- **draft:** available for learning/search, never used for automatic correction.
- **reviewed:** wording, examples, exceptions and likely false positives have been checked.
- **tested:** positive and negative regression cases pass; the engine may execute the matcher.
- **deprecated:** retained for traceability but no longer selected.

The current engine's supported executable statuses remain tested, policy and draft; new lifecycle labels must not be introduced into runtime data without updating the validator and tests.

## Feedback behavior

- Show the closest high-confidence grammatical correction first.
- Explain the reason in English and Spanish at the learner's level.
- Show a short correct example and, where appropriate, a separate “More natural” alternative.
- Distinguish detected errors from missing task information.
- When no rule matches, say that the answer was not fully checked. Never label it correct merely because no known pattern matched.
- Let the learner retry the same concept in a new sentence and record the stable rule ID for later review.
- Limit the number of corrections shown at once; the live coach may surface several known issues, while submitted feedback keeps one primary correction prominent.

## Optional AI boundary

An AI provider, if added, should be an adapter behind a stable interface. The app must continue without it. AI output should be labelled as a suggestion, validated against deterministic rule results, and never overwrite the original response or a verified correction. Provider failure, lack of connectivity or exhausted quota must fall back to the local coach. Do not send learner text to a remote provider unless that provider is explicitly configured and the learner is informed.

## Validation gates

For each new tested rule:

1. Add it to a source linguistic pack and rebuild the generated catalog.
2. Add at least one positive regression case and plausible negative cases.
3. Check the corrected text, rule ID, case preservation and punctuation.
4. Confirm correct alternatives and unfamiliar vocabulary remain unchanged.
5. Confirm the rule's examples and bilingual explanation appear through the shared feedback contract.
6. Run the full npm test suite and verify PWA cache invalidation after runtime changes.
7. Smoke-test the interaction in a desktop browser and Android-installed PWA, including offline behavior.

## First implementation slice

The present-continuous rules are being strengthened first because they cover a common conversational need. The shared toGerund transform now uses reviewed common forms (for example, feeling, opening, playing, running and sitting) rather than blindly doubling a final consonant. PRES-CONT-FEEL-001 handles the narrow pattern be + feel + adjective, and an optional natural reply such as “Good, I'm doing well” remains separate from the correction “Good, I am feeling good.” This is a scoped improvement, not a claim that the local checker recognizes every possible English error.
