# HODIE Learning Engine v0.2

Local-first deterministic engine for the HODIE A2→B1 learning model.

## Architecture

Can-Do → Evidence → Gap → Recovery → Activity → Feedback → Retry → Progress → Review

The engine does not require an AI API.

## Files

- `src/learning-engine.js` — core deterministic engine.
- `tests/learning-engine.test.js` — executable smoke tests.
- `data/can-do-matrix.json` — pedagogical Can-Dos.
- `data/progress-model.json` — progress and evidence rules.

## Important rule

The engine selects and adapts learning targets. It does not pretend that a score is an official CEFR level.

## Run

```bash
node tests/learning-engine.test.js
```
