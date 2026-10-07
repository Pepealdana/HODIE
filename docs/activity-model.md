# HODIE Activity Model v1

## Purpose

The Activity Model is the bridge between the pedagogical model and the future interface.

HODIE does not organize learning as a list of lessons. It generates or selects activities because a Can-Do requires practice, evidence, recovery or review.

## Activity families

1. Recognition — notice a useful word, pattern or sound.
2. Controlled practice — practice a language resource with limited choices.
3. Listening comprehension — understand gist, details or intention.
4. Reading comprehension — understand functional or professional text.
5. Guided production — produce English with scaffolding.
6. Independent production — demonstrate a Can-Do independently.
7. Interaction — ask, respond, clarify, repair, suggest and negotiate.
8. Repair / retry — address a detected gap and retry the original task.
9. Pronunciation — improve intelligibility, stress, rhythm or intonation in meaningful language.
10. Integrated task — combine comprehension and production in a realistic situation.

## Selection logic

The engine should follow this general path:

CAN-DO → GAP → ACTIVITY TYPE → PRACTICE → EVIDENCE → RETRY

A failed communicative task should not automatically become a grammar lesson. The engine first identifies the smallest actionable gap. Grammar, vocabulary or pronunciation practice is then used as support, followed by another attempt at the original communication task.

## Activity versus evidence

Completing an activity is not equivalent to mastering a Can-Do.

Example:

- Activity: practice present perfect.
- Evidence: explain a real professional experience using the target language.
- Decision: update the Speaking Can-Do, not merely a grammar score.

## Personalization

The first content library should use Peters' real contexts:

- technology
- programming
- robotics
- teaching
- STEAM
- projects
- professional communication
- everyday life

This gives HODIE meaningful repetition without making the system dependent on one person.

## Next implementation step

The next layer is the content model: reusable prompts, expected responses, distractors, audio/text assets, feedback templates and evidence mapping. Content must remain separate from the engine so the same activity types can be reused across different Can-Dos.
