# HODIE CEFR activity balance and B2 readiness gate

## Activity inventory

| Skill | A1 | A2 | B1 | B2 (locked pack) |
|---|---:|---:|---:|---:|
| Grammar | 3 | 27 | 11 | 4 |
| Vocabulary | 3 | 15 | 6 | 4 |
| Listening | 3 | 12 | 10 | 4 |
| Speaking | 3 | 14 | 12 | 4 |
| Writing | 3 | 8 | 9 | 4 |
| Reading | 3 | 7 | 8 | 4 |
| Pronunciation | 3 | 8 | 6 | 4 |
| Communication | 4 | 7 | 9 | 4 |
| **Active activities total** | **25** | **98** | **71** | **32** |

The A1/A2/B1 totals in this table include the current full-activity bank as well as micro-practice. B2 remains in a separate package and is not counted as active practice.

Additional content in the separate B2 package: **8 full tasks, 3 guided simulations and 8 B2 Can-Do targets**, in addition to its 32 micro-activities. The B2 package is built now but stays outside the active banks until the learner gate passes.

The A1 matrix now has eight Can-Do targets, one for each HODIE skill. The B1 bank now has at least one linked activity for all 60 B1 Can-Do targets, rather than concentrating exercises on only a subset of the level. Previously A1 had only reading, pronunciation and communication targets, which made its foundational coverage incomplete.

## Design principles

- Use CEFR-aligned Can-Do descriptors and familiar real-life contexts.
- Balance receptive skills (reading/listening), productive skills (speaking/writing), pronunciation, grammar, vocabulary and interaction.
- Revisit A1 foundations inside later practice; selecting a higher level does not disable access to lower-level support.
- Keep completion counts as usage evidence, not as proof of proficiency.
- Separate language correctness from task completion and communicative effectiveness.
- Treat the gate as an internal readiness estimate, not an official CEFR certification.

## B2 gate: B2-READINESS-V1

The app evaluates this gate from the learner's local evidence profile whenever the home is rendered or the learner requests B2.

1. **A1 foundations:** at least 70% of A1 Can-Dos must be mastered, with at least 50% coverage in each represented core communicative skill.
2. **Progression prerequisites:** the existing progression engine must mark A2, A2+ and B1 as ready from Can-Do evidence.
3. **B1 breadth:** at least 75% of B1 Can-Dos must be mastered. Each of speaking, listening, reading and writing, plus communication, must have at least 60% coverage.
4. **Independent transfer:** at least two distinct B1 Can-Dos must show independent evidence with confidence 4 or higher and an evidence-dimension score of at least 0.75, across at least two contexts.
5. **Mastery quality:** a Can-Do is considered mastered only when the existing learning engine finds repeated successful independent evidence in different contexts. A large number of attempts or completed exercises cannot satisfy this requirement by itself.

The gate returns a readiness decision, evidence metrics and actionable reasons. When it passes, the app merges the B2 Can-Dos, micro-activities, full tasks and simulations into the active banks. When it does not pass, the pack stays isolated and the B2 selector remains disabled.

## B2 content package

File: `data/b2-learning-pack.json`

- 32 micro-activities: four for each of the eight skills.
- 8 full performance tasks, one per skill.
- 3 guided simulations: structured debate, complex problem-solving and expert interview.
- 8 B2 Can-Do descriptors, each linked to a B1 prerequisite.
- Each task contains bilingual prompts and CEFR Companion Volume alignment metadata.

**Editorial status:** the B2 content is drafted and structurally checked, but explicitly marked `ready-for-editorial-review`. It must not be described as expert-validated or as an official CEFR assessment until a qualified review is completed.

## Automated guardrails

- At least three active activities for every skill at each of A1, A2 and B1, plus at least one linked activity for every B1 Can-Do.
- No B2 activity in the active micro/full banks before the gate passes.
- A separate test verifies B2 package completeness and isolation.
- A separate gate test verifies that repeated independent evidence and transfer are required; activity counts alone do not unlock B2.
- The PWA cache is invalidated when the runtime or learning data changes.
