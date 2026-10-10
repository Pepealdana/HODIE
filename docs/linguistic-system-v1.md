# HODIE Linguistic System v1

## Purpose and scope

The linguistic catalog is a versioned, editable knowledge source aligned to communicative functions and levels described by the CEFR Companion Volume. The labels A1, A2 and B1 are instructional targets, not an official HODIE certification. This initial package is an A1–B1 starter slice, not a complete English grammar or vocabulary reference.

## Data contract

`data/linguistic-catalog.json` is the canonical content catalog. It contains:

- `communicativeFunctions`: observable real-life functions mapped to skills, structures, domains, contexts and existing Can-Do IDs.
- `grammarRules`: stable rule IDs, CEFR target, category, bilingual explanation, correct and incorrect examples, priority and review status.
- `vocabularyEntries`: lemmas, parts of speech, forms, domains, collocations and example usage. Entries may be added without editing the analysis engine.
- `testCases`: regression examples specifying expected rule IDs and corrected text.
- `policy`: open-vocabulary and ambiguity rules.

## Shared analysis pipeline

`src/linguistic-engine.js` is the common deterministic analysis engine used by conversation feedback and micro-practice. It returns the original text, corrected text, prioritized error records, unknown-word observations and catalog coverage. It never treats an unknown word as an error by itself. Additional job vocabulary can be passed into the analyzer to reuse existing grammar patterns.

Rules are intentionally conservative. A correction is made only when a reviewed pattern matches. Expressions with legitimate alternatives (for example, `I like teaching` and `I like to teach`) must remain valid. Context-dependent forms such as `work at` and `work in` are not globally interchangeable or globally erroneous.

## Rule lifecycle

1. Add a stable rule ID and bilingual metadata.
2. Add positive examples, incorrect examples and plausible false-positive cases.
3. Add test cases to `testCases` or the engine test.
4. Validate the catalog schema and run the full `npm test` suite.
5. Mark a rule `tested` only after the tests pass and its false-positive cases have been reviewed. New rules should begin as `draft`.
6. Link the rule to communicative functions, Can-Do outcomes, practice activities and feedback examples.
7. Review reported learner errors and add new words or rules as data, not as hard-coded UI branches.

## Feedback policy

- Show one primary correction first, near the learner's response.
- Include a short explanation in English and Spanish for A1/A2 where useful.
- Provide one reusable correct example.
- Ask the learner to produce the corrected pattern or use it in a new sentence.
- Separate language accuracy from task completion and learner confidence.
- Do not interrupt or rewrite ambiguous input as if the interpretation were certain.

## Open-vocabulary policy

English is productive and cannot be represented by a finite list. Unknown words should remain usable. HODIE can apply grammatical rules around them, and vocabulary entries can extend selected rule patterns through data. Unknown-word observations may support later review, but must not become an error without evidence. Spelling auto-correction should only be enabled for reviewed, high-confidence candidates with an unambiguous context.

## Current limitations

This starter engine is not a full parser, spellchecker, dictionary, speech recognizer or CEFR assessor. Its rule coverage is finite. It should not claim complete grammar detection or precise pronunciation scoring. The catalog and regression tests are designed to grow in small validated packages rather than by unreviewed bulk additions.
