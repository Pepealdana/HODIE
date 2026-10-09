# HODIE Micro-Practice Methodology v1

## Purpose

HODIE should feel like practicing English, not completing a rigid questionnaire.

The existing Can-Do, evidence, progression, retention and adaptive-planner architecture remains the pedagogical backbone. The learner-facing interaction is reorganized around short actions and immediate feedback.

## Core loop

```
ACT → FEEDBACK → RETRY (when useful) → NEXT ACTION
                         ↓
                 INTEGRATED DEMONSTRATION
                         ↓
                      EVIDENCE
                         ↓
              PROGRESS / RECOVERY / RETENTION
```

## Two different units

### Can-Do

The Can-Do remains the unit of capability and progression.

Examples:

- I can introduce myself and give basic personal information.
- I can talk about my family.
- I can describe my daily routine.

### Micro-activity

A micro-activity is the unit of interaction.

Supported types:

- choose
- complete
- order
- match
- listening
- speak
- mini-production

A Can-Do may be practiced through several micro-activities and contexts.

## Session design

A normal session does not need to contain every activity type.

HODIE can:

1. choose a mixed sequence;
2. let the learner choose a skill;
3. target a detected gap;
4. review a retention need;
5. finish with a short integrated demonstration when evidence is appropriate.

The default should be **Mixed**.

## Immediate feedback

Deterministic activities receive feedback immediately.

Feedback should be:

- short;
- actionable;
- bilingual when useful at A2;
- focused on the highest-value correction;
- followed by another attempt when retry has pedagogical value.

Do not force a navigation screen after every micro-activity.

## Confidence

Confidence is diagnostic.

A confidence value of 1–3 must not automatically block progression when performance evidence is sufficient.

Confidence becomes more relevant for consolidation and transfer, where sustained autonomous performance matters.

## Requirements

Requirements belong to the activity.

Examples:

- minimum response length;
- expected duration;
- required information;
- target language feature.

They must be shown before the learner acts.

A requirement is a task constraint, not a definition of the learner's CEFR level.

## Writing load

A2 practice should not default to long writing.

HODIE should progress from:

```
recognize → choose → complete → order → listen → speak → produce
```

Longer writing or speaking tasks belong to integrated demonstrations, not every exercise.

## Skill balance

The system should develop:

- speaking;
- listening;
- reading;
- writing;
- communication;
- vocabulary;
- grammar;
- pronunciation.

Grammar and vocabulary remain resources for communication rather than the final goal.

## Personal relevance

Practice content should preferentially use the learner's real contexts:

- technology;
- programming;
- robotics;
- teaching;
- STEAM;
- school situations;
- professional communication;
- family and daily life;
- personal projects.

Personal relevance should make practice meaningful without preventing transfer to unfamiliar contexts.

## Architecture boundary

Micro-practice does not replace the existing Learning Engine.

```
Micro Practice
    ↓
Session / Evidence Boundary
    ↓
Learning Engine
    ↓
Progression & Retention
    ↓
Adaptive Planner
```

Micro-practice provides action and diagnostic signals. The existing evidence boundary remains responsible for authoritative Can-Do progress mutation.

## Product principle

HODIE should minimize interface friction without minimizing pedagogical depth.

**Less clicking. More English.**
