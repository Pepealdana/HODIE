# Evidence Contract v1

## Purpose

Define the contract between a HODIE learning session, learner performance, progress registration and the next adaptive session.

## Session lifecycle

```
planned
  ↓
started
  ↓
awaiting-evidence
  ↓
completed
  ↓
register-evidence
  ↓
retry-required OR next
```

Completing a screen or activity is not evidence of mastery. HODIE requires observable performance evidence attached to the relevant Can-Do.

## Evidence identity

Every evidence record should identify:

- `sessionId`
- `activityId`
- `canDoId`
- `contextId`
- `timestamp`

This makes progress traceable without coupling the learning engine to the future UI.

## Performance

Evidence contains:

- `independent`
- `confidence` from 1 to 5
- normalized `dimensions`
- structured `errors`

Confidence is diagnostic. It cannot replace performance evidence.

## Lifecycle rule

A failed communicative attempt produces a targeted gap and normally creates:

```
RECOVERY → TARGET → RETRY
```

A successful attempt advances to the adaptive planner:

```
EVIDENCE → STATUS/REVIEW → NEXT TARGET → NEXT SESSION
```

Raw evidence is append-only. Status, gaps and reviews are derived data.
