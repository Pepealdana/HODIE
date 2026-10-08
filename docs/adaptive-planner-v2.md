# HODIE Adaptive Planner v2 — Progression & Retention

## Purpose

Adaptive Planner v2 integrates the Phase 3 Progression & Retention Model into target selection.

The planner now considers three complementary questions:

1. What Can-Do needs attention now?
2. Which mastered Can-Dos need maintenance?
3. Which eligible Can-Dos support the next functional progression target?

## Decision model

Selection remains evidence-driven:

`priority + status need + skill weight + review need + recent gap + context + progression + retention`

### Progression

The planner reads `evaluateProgression()` and gives a controlled bonus to Can-Dos at the learner's `nextTargetLevel`.

Progression never bypasses prerequisites.

### Retention

Retention is maintenance, not remediation.

- `current`: no maintenance bonus.
- `due`: maintenance bonus for consolidated/transferred Can-Dos.
- `atRisk`: stronger maintenance bonus for consolidated/transferred Can-Dos.

Functional or developing Can-Dos do not receive a retention bonus merely because a review date exists; they remain learning targets.

Time alone does not downgrade mastery.

## Selection order

The planner does not use a rigid single queue. It ranks eligible candidates using weighted signals.

Conceptually:

1. mandatory recovery/retry is handled by the session flow;
2. recent gaps and high-priority needs increase score;
3. retention increases score when previously mastered capacity is due;
4. progression increases score for the next target level;
5. prerequisites remain a hard eligibility boundary.

## Explainability

`explainSelection()` exposes reasons such as:

- high-priority Can-Do
- skill still developing
- review is due
- maintenance review is due
- retention is at risk
- supports the next progression target
- continues from the most recent Can-Do

## Important boundary

Planner v2 does not declare CEFR certification.

Progression remains a functional HODIE estimate. The planner only uses the progression state to improve target selection.

## Tests

The planner tests cover:

- normal adaptive selection;
- retention due for a consolidated Can-Do;
- progression toward A2+;
- retention at-risk explanation.

Content availability remains separate from planner logic. A target can be pedagogically correct even when no executable activity exists yet.

