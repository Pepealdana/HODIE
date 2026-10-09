# HODIE — Fase 2: Modelo de progreso y evidencia

## Objetivo

HODIE no debe responder solamente «Obtuviste 80%». Debe identificar qué puede hacer el estudiante, qué gap explica el desempeño y qué debe practicar después.

## 1. Tres dimensiones

**KNOWLEDGE**: reconoce reglas, vocabulario y explicaciones.

**ABILITY**: puede comprender, hablar, escribir, interactuar y usar recursos lingüísticos.

**CONFIDENCE**: autonomía y percepción del propio desempeño.

Una puntuación alta de conocimiento nunca debe compensar una incapacidad para usar el idioma.

## 2. Niveles de evidencia

1. attempt — lo intenta.
2. supported — lo consigue con apoyo.
3. independent — lo consigue autónomamente.
4. consistent — lo consigue repetidamente con contenido diferente.
5. transfer — utiliza la habilidad en un contexto nuevo pero relacionado.

Esto evita declarar dominio después de una sola respuesta correcta.

## 3. Estado de cada Can-Do

notStarted → emerging → developing → functional → consolidated → transferred.

## 4. Evidencia por habilidad

**Speaking:** task completion, grammar, fluency, vocabulary, pronunciation, interaction, confidence.

**Listening:** gist, details, accuracy, inference, confidence.

**Reading:** gist, details, accuracy, inference, confidence.

**Writing:** task completion, accuracy, coherence, clarity, vocabulary, grammar, confidence.

**Communication:** task completion, interaction, repair, confidence.

**Vocabulary:** recall, use, spontaneous use.

**Grammar:** accuracy, communicative use.

**Pronunciation:** intelligibility, prosody, confidence.

## 5. Del error al diagnóstico

El orden inicial será: **fallo de tarea → problema de comunicación → recurso lingüístico → fluidez → confianza**.

El objetivo es encontrar el gap mínimo accionable. Si el estudiante puede comunicar una idea pero usa una estructura incorrecta, se corrige la estructura y se vuelve inmediatamente a la tarea comunicativa.

## 6. Mastery

Un Can-Do no se domina con un único acierto.

Regla inicial: mínimo 2 evidencias, mínimo 2 evidencias independientes, idealmente en contextos diferentes y confianza objetivo por defecto de 4/5.

Para Grammar y Vocabulary, el dominio debe demostrarse mediante uso comunicativo, no solamente mediante ejercicios aislados.

## 7. Puntuación

Los índices internos estarán normalizados entre 0 y 1, pero **no representan porcentaje de inglés aprendido**.

Pesos iniciales: Speaking 28%, Listening 24%, Reading 16%, Writing 14%, Communication 12%, Vocabulary 3%, Grammar 2%, Pronunciation 1%.

El índice global es secundario. La interfaz debe mostrar el perfil por dominio y no convertir el índice en una etiqueta automática de B1.

## 8. Progreso A2 → B1

No habrá una barra artificial «A2 63% → B1». El progreso se determina mediante cobertura y evidencia de los Can-Dos relevantes, especialmente los críticos y Meta-Can-Dos.

## 9. Recuperación

Cuando falla una actividad: **Evidence → Gap → Recovery → Practice → Retry**.

El motor debe regresar al prerrequisito o recurso adecuado. Un problema de vocabulary no debe enviar automáticamente a una lección de grammar; un problema de pronunciation debe activar una intervención fonológica; un problema de confidence puede requerir menor dificultad o más apoyo.

## 10. Spaced review

Se conserva inicialmente: **1 → 2 → 4 → 7 → 14 → 30 días**. La revisión dependerá de la evidencia y de los fallos posteriores, no solamente de completar actividades.

## 11. Personalización

El primer perfil de HODIE se contextualiza en teaching, technology, programming, robotics, STEAM, professional communication, family y everyday life.

El núcleo pedagógico permanece separado del contenido: **Can-Do ≠ contenido**.

## 12. Decisión del Learning Engine

El motor combinará prioridad del Can-Do, evidencia actual, errores recientes, confidence, revisión pendiente, objetivos del estudiante y variedad de contenidos para seleccionar la **NEXT BEST ACTIVITY**.

## 13. Gate de Fase 2

### APROBADA COMO MODELO BASE

La siguiente fase es adaptar el Learning Engine para seleccionar Can-Dos, registrar evidencia, detectar gaps, recuperar prerrequisitos, producir feedback bilingüe, exigir retry, actualizar estados y programar revisión.
## 14. Phase 3 — Progression & Retention

The progression and maintenance policy is implemented in `src/progression-retention.js` and documented in `docs/progression-retention-v1.md`.

It separates:
- **Can-Do mastery**: functional/consolidated/transferred status;
- **level readiness**: evidence coverage across communicative domains;
- **retention state**: current, due, atRisk or unscheduled.

A review being overdue does **not** erase mastery. New evidence must demonstrate deterioration before the Can-Do status changes.

