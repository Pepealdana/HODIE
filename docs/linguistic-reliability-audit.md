# Linguistic reliability audit — October 2026

## Purpose

HODIE is a local-first English-learning app. Its deterministic language checker is a reviewed pattern checker, not a general-purpose grammar model or an official CEFR assessor. It must not turn “no matching rule” into “the answer is correct”.

## Audited response path

1. The learner submits text or a speech-recognition transcript.
2. `evaluateExperienceTurn` checks the task and records any missing communicative requirements.
3. `applyLinguisticReview` runs `analyzeLanguage` independently of activity linkage.
4. The linguistic index retrieves related grammar/vocabulary records locally.
5. `createFeedbackContract` normalizes detected corrections, task requirements, evaluation scope and next action.
6. The UI shows a correction, a self-review prompt, or a clearly labelled related resource.

## Reliability rules

- A rule may automatically correct only when its catalog status is `tested` and its matcher/implementation has regression coverage.
- Draft rules remain searchable and explanatory but do not auto-correct.
- Unknown words are not errors by themselves.
- A related search result is not evidence that the learner made that error. UI must label it as a related resource, not a diagnosis.
- A rule-based result with no matching correction is `not-fully-evaluated`, not objectively correct.
- Speech-to-text may substitute words. HODIE must not silently replace a plausible word with another word merely because the latter fits context.
- Corrections should offer a useful explanation in English and Spanish and a next action.

## A1–A2 patterns added in this slice

- `DO-NEG-BASE-001`: common present-simple negatives use the base verb after don't/doesn't.
- `DID-NEG-BASE-001`: reviewed past forms after didn't/did not are normalized to the base verb.
- `MODAL-TO-BASE-001`: a reviewed list of modal verbs is followed by the base verb without `to`.

Each rule includes correct examples, incorrect examples, exceptions, negative cases and catalog regression cases. These are intentionally narrow rules; they do not claim complete coverage of all verbs or all English grammar.

## Regression and release gate

Run `npm test`. The test pipeline rebuilds the generated linguistic catalog from `data/linguistic-packs/*.json`, then checks the application, PWA, feedback contract, learning flows, linguistic catalog, rule corrections, negative cases, search index and activity integration.

Before merging a new automatic rule:
1. Add it to a source pack, not only to the generated catalog.
2. Provide English and Spanish explanations, examples, exceptions and negative cases.
3. Add positive and negative regression cases.
4. Confirm that the new rule does not alter valid alternatives or unknown vocabulary.
5. Confirm all CI checks pass.

## Known limitations

- Pattern-based analysis cannot reliably diagnose every grammatical error in open production.
- Contextual search is keyword-based; suggestions must remain explicitly non-diagnostic unless a tested rule matched.
- Browser speech recognition quality depends on the browser, device, microphone and language settings. The app can assess only the transcript it receives.
- No paid API is required for the deterministic checker, catalog, search, feedback contract or offline practice. An optional AI provider may be evaluated later for ambiguous cases, but it must not override verified rules or be required for core learning.

## Acceptance criteria for this work

- No-match responses are never labelled “Good response” solely because the checker found no rule.
- The feedback contract exposes the evaluation status and the partial scope of deterministic checking.
- The learner can review/edit a transcript before continuing.
- Related knowledge is displayed as a study resource, never as a confirmed diagnosis.
- The new A1–A2 rules pass positive and negative regression cases.
- The PWA cache version is incremented when runtime code changes.


## October 2026 rule refinement

- PRES-CONT-BASE-001 now covers a reviewed set of common dynamic verbs and uses one shared gerund transformer. The transformer avoids false doubling in forms such as feeling and opening, while retaining reviewed forms such as running, sitting and beginning.
- PRES-CONT-FEEL-001 handles the narrow, high-confidence pattern be + feel + adjective (for example, I am feel good → I am feeling good). It preserves correct alternatives such as I feel good, I am feeling good, I am ready and I am happy.
- A natural rephrasing such as Good, I am doing well is presented as an optional natural alternative, separate from the grammatical correction. It must not replace the learner's intended sentence silently.
