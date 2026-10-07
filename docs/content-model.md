# HODIE Content Model v1

## Purpose

The Content Model defines how an individual activity is represented. It is separate from the Learning Engine and the interface.

The engine decides what needs practice. Content defines what the learner sees, reads, hears or says.

## Core relationship

CAN-DO -> ACTIVITY -> RESPONSE -> EVIDENCE -> FEEDBACK -> RETRY

Every activity has one primary Can-Do. Grammar, vocabulary or pronunciation may support it, but do not replace the communicative target.

## Required fields

Every activity must declare a stable id, canDoId, activityType, level, primary skill, title, objective, instructions, task, evidence, feedback and retry.

Optional fields provide support, expected response shape, context and metadata.

## Evidence

Evidence must be observable. Internal states such as mental translation are not sufficient as sole evidence.

Useful evidence includes task completion, comprehension accuracy, relevant details, meaningful grammar and vocabulary use, fluency, intelligibility, interaction and confidence.

## Feedback

The learner's strongest language may explain an error. Practice and demonstration remain in English.

Default sequence:
1. What happened.
2. What to change.
3. Why, briefly.
4. One useful example.
5. Retry.

Priority corrections are limited so feedback does not unnecessarily interrupt fluency.

## Retry

For an important error HODIE should identify the smallest actionable gap, provide targeted recovery, require a retry when appropriate, return to the original communicative Can-Do and register new evidence.

## Separation of concerns

- can-do-matrix.json = what the learner can do.
- progress-model.json = how evidence changes progress.
- activity-model.json = what kinds of practice exist.
- content-model.json = how an individual activity is represented.
- learning-engine.js = deterministic decision logic.
- future UI = presentation and interaction.
