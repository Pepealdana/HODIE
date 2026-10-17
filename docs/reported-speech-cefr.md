# Reported Speech in HODIE

## Purpose and CEFR-informed progression

This is a HODIE learning pathway informed by CEFR communicative progression, not an official CEFR mapping or certification.

- **A1 — recognition and mediation:** identify who said a short familiar message and preserve its basic meaning. Learners are not expected to master tense backshift at this stage.
- **A2 — familiar statements:** practise common reported statements, pronoun reference and frequent tense changes after a past reporting verb.
- **B1 — conversations and requests:** report questions with statement word order, requests, advice and short interviews.
- **B2 — stance and nuance:** attribute claims, distinguish evidence from opinion, select reporting verbs and summarise discussion fairly.

Each level currently has four bilingual microactivities across grammar, reading, listening, writing or communication. The first content slice contains 16 activities; it is a starting module, not the full reported-speech curriculum.

## Runtime integration

The activity catalogue reads `data/micro-practice-library.json` and filters by selected level, skill and topic. Search for either “Reported Speech” or “Estilo indirecto”. Activities use the existing micro-practice evaluator and feedback model; no separate runtime or AI dependency is required.

Learning targets live in `data/can-do-matrix.json`. A2 reported-speech targets depend on the existing A2 introduction target; B1 targets depend on a B1 speaking target; B2 targets depend on B1 speaking and communication targets. These prerequisites are normal progression constraints, not a substitute for the future B2 unlock decision.

## Correction rules and confidence

Two narrow rules currently correct reviewed examples:
- `She said, "I am tired."` → `She said that she was tired.`
- `He said, "I am busy."` → `He said that he was busy.`

The tested matchers deliberately cover only these quoted forms. They must not be generalized to arbitrary names, pronouns, verb tenses or contexts without new positive and negative tests. “Said”/“told”, indirect question word order, requests, advice and reporting verbs are available as practice content; broader automatic correction remains draft until it has safe context-aware implementations.

## B2 visibility

B2 activities are authored in the library now, but the level selector remains disabled and the catalogue returns no B2 activities. `isB2Unlocked()` currently returns false intentionally. A later progression gate must assess independent evidence across skills and Can-Do goals, retention and transfer—not activity count alone—before changing that behavior.

## Validation

The regression suite checks rule IDs and exact corrections, negative cases, activity counts by level, bilingual feedback, Can-Do links and the PWA cache contract. Automated checks must pass before merge. A desktop and Android PWA smoke test remains necessary after deployment.
