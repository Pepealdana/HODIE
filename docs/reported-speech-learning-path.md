# Reported speech in HODIE

## Scope and progression

HODIE introduces reported speech as a CEFR-aligned communicative pathway, not as a claim that the CEFR mandates a fixed grammar syllabus. A1 works with simple reporting of greetings and short messages; A2 with familiar statements and say/tell/pronoun choices; B1 with reported questions, requests, common backshift and time references; B2 with summaries, attribution, reporting verbs, stance and uncertainty.

## Runtime architecture

- Can-Do targets live in `data/can-do-matrix.json`.
- Complete activities live in `data/content-library.json` and contribute observable evidence.
- Short, reusable activities live in `data/micro-practice-library.json` and are searchable by level, skill and the `reported-speech` tag.
- The linguistic explanation lives in a source linguistic pack and is rebuilt into `data/linguistic-catalog.json`.
- The current broad rule is deliberately `draft` and explain-only. The engine must not automatically rewrite reported speech until each narrow transformation has reviewed positive and negative regression cases. Context-sensitive forms must not be corrected by a blanket tense-shift rule.
- The home screen provides a dedicated pathway selector. The catalogue also exposes the individual tasks. The same tasks are used by practice, feedback, retry and local progress.

## B2 unlock policy

The B2 content is authored and stored up front, but the level selector and catalogue must not expose it as playable until the learner's B1 evidence is broad and consistent. Unlock is not based on completed activity count alone. Each of the four core skills (speaking, listening, reading, writing) must have at least three functional-or-better B1 Can-Dos and at least one consolidated/transferred Can-Do. Communication must have at least two functional-or-better Can-Dos and one consolidated/transferred. Grammar, vocabulary and pronunciation must each have at least two functional-or-better B1 Can-Dos and one consolidated/transferred. The consolidated state itself requires two independent high-scoring attempts in distinct contexts with confidence at least 4, as defined by the learning engine. If any condition is missing, show the precise skill gap and keep B2 activities hidden from the playable catalogue.

The unlock indicates readiness within HODIE's evidence model; it is not an official CEFR certification. Learners can continue practising A1–B1 at any time. The B2 content remains in the local library so it can be validated and tested before release.

## Feedback and evaluation

Comprehension activities evaluate selected meaning against authored answer keys. Production activities use observable criteria and prompts; they do not claim to certify the full grammar of an open answer. Feedback distinguishes (1) a confirmed structural issue, (2) a plausible alternative, and (3) a response that the local rules could not fully evaluate. Natural alternatives are suggestions, never silent replacements for the learner's meaning.

## Quality gates

- Every Can-Do has at least four short practice items and one complete activity.
- Every activity is linked to one Can-Do, one level, one primary skill and a stable reported-speech tag.
- B2 activities have internal content QA metadata; this is not a claim of official CEFR review.
- Positive/negative linguistic tests, activity coverage tests, B2-gate tests, PWA cache checks and the full CI suite must pass before merge.


## Confidence and evidence

The final response includes a 1–5 learner confidence self-report. HODIE stores it separately from language accuracy and task completion. The existing progress model requires confidence of at least 4, two independent successful attempts, and distinct contexts before a Can-Do can become consolidated. Reported-speech evidence uses dimensions appropriate to the selected skill rather than writing generic grammar/fluency dimensions into listening or reading evidence.
