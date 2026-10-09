# HODIE Learning Experience Architecture v1

## Product question

> After using HODIE for months, can Peters communicate better in English?

This is the primary product criterion. HODIE is a learning environment, not a collection of lessons.

## System layers

HODIE
- Learning map: Can-Dos
- Learning engine: evidence, gaps, progression, retention
- Learning experiences:
  - Practice: Mixed, Review, Speaking, Listening, Writing, Grammar, Vocabulary
  - Conversations: guided open conversation in v1
  - Simulations: Interview, Class, Presentation
- Interface: mobile-first, simple, direct

## Separation of responsibilities

### Practice

Micro-activities train a specific skill or language resource. They can be choose, complete, order, match, listening, speak, writing or short production.

Practice does not automatically mutate authoritative progress.

### Conversation

A conversation is an open-response sequence.

In v1, without AI, HODIE gives a prompt, accepts spoken or typed responses, checks observable signals, provides immediate language corrections and continues without requiring one exact answer.

It is intentionally not presented as full semantic AI conversation.

### Simulation

A simulation gives the learner a role, situation and communicative objective.

Initial examples:
- job interview;
- teach a mini class;
- explain a robotics project.

These experiences are practice-only in v1 and do not directly create authoritative Can-Do evidence.

## Orchestration

The learning orchestrator chooses the recommended learning surface.

Priority:
1. retention risk or recent gaps → Review;
2. active communication need → Conversation;
3. appropriate higher-level professional context → Simulation;
4. otherwise → Mixed practice.

The learner can always choose another experience.

## Progression

Progression remains evidence-driven:

activity → evidence → Can-Do status → skill profile → level readiness

Completing an experience does not itself mean promotion.

## Retention

Mastered capacities are scheduled for maintenance.

Time creates review need; it does not automatically erase mastery. New evidence can preserve mastery or reveal a gap that routes the learner to recovery.

## No AI in v1

AI is intentionally deferred until the differentiated practice modes, conversation/simulation UX, evidence boundary, progression, retention and mobile experience are stable.

AI can later extend open conversation, natural correction, role-play and adaptive follow-up without replacing the learning engine.

## Mobile-first

The primary interaction is a short mobile session:
- one clear action at a time;
- large touch targets;
- minimal typing when speaking/listening is the goal;
- immediate feedback;
- resumable sessions;
- no desktop-only layout assumptions.

## Product invariant

Every new experience must answer:
1. What communicative capability does it support?
2. What learner action does it require?
3. What feedback does it provide?
4. Is it practice or authoritative evidence?
5. What can the learning engine do with the result?
6. Why is this useful for the learner's real life?
