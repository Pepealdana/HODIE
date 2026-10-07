# Evidence Boundary & Session Integration v1

## Purpose

HODIE separates the pedagogical engine from the execution boundary.

The low-level learning engine can register normalized evidence, but session evidence must pass through an integrity boundary before it mutates learner progress.

## Flow

```
Session
  ↓
awaiting-evidence
  ↓
completeSession()
  ↓
submitSessionEvidence()
  ↓
validate sessionId
validate canDoId
validate activityId
validate activity belongs to session
validate activity is the declared assessment activity
validate activity belongs to Can-Do
validate evidence payload
  ↓
registerEvidence()
  ↓
retryRequired?
  ├─ yes → retry-required → recovery session
  └─ no  → next → adaptive session
```

## Evidence integrity rules

A session evidence submission requires:

- `sessionId`
- `activityId`
- `canDoId`
- `contextId`
- `timestamp`
- `independent`
- `confidence` from 1 to 5
- `dimensions`
- `errors`

The boundary verifies:

1. The session exists and is in `awaiting-evidence` or `completed`.
2. The evidence session ID matches the session.
3. The evidence Can-Do matches the session target.
4. The activity is explicitly listed in the session evidence contract.
5. The activity exists in the content library.
6. The activity is the session's declared `assessmentActivityId`.
7. The activity belongs to the session Can-Do.

Recovery activities are intentionally excluded from progress-mutating evidence. They prepare the learner; the target/assessment activity demonstrates the Can-Do.

## Deterministic time

Progress review scheduling accepts an optional `now` value.

Production code may omit it and use the current clock.

Tests should inject a fixed timestamp so review calculations remain deterministic.

## Single executable flow

`src/session-runner.js` is the only executable orchestration path.

The former `src/learning-cycle.js` path was removed because it bypassed session state and the evidence boundary. The learning engine remains a lower-level evidence/progress component; it does not create sessions or activities.

## Session runner

`src/session-runner.js` is the orchestration boundary for the executable learning loop:

```
planned
  → started
  → awaiting-evidence
  → completed
  → register evidence
  → retry-required | next
```

The runner does not mutate the original session or learner profile. It returns derived results and the next session.

## Important distinction

A detected gap does not automatically mean retry.

Retry is controlled by `result.retryRequired`.

A learner can succeed at the Can-Do while showing a minor weakness. In that case HODIE records the gap but advances rather than forcing an unnecessary retry.

## Content availability

Session selection uses activity-backed Can-Dos only.

A Can-Do without content is a valid future learning target but cannot be executed as a session until an activity is added to the library.
