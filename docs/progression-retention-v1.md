# HODIE — Phase 3: Progression & Retention Model v1

## Objetivo

Añadir, encima del Learning Engine, una capa que responda dos preguntas distintas:

1. **Progression:** ¿qué nivel funcional está listo para ser trabajado/considerado?
2. **Retention:** ¿qué capacidades ya dominadas necesitan mantenimiento?

La capa no sustituye al Learning Engine. Consume sus estados de Can-Do y sus evidencias.

## 1. Principio central

Una actividad terminada no eleva automáticamente el nivel.

La cadena es:

`Activity → Evidence → Can-Do status → Skill profile → Level readiness`

El nivel es una estimación funcional alineada con CEFR, no una certificación.

## 2. Can-Do mastery

La capa considera como dominio fuerte:

- `consolidated`
- `transferred`

`functional` demuestra capacidad independiente, pero todavía no basta para declarar dominio consolidado de un nivel.

## 3. Gates de progresión

La política inicial usa tres condiciones:

### A2
- mínimo 70% de los Can-Dos A2 en estado `consolidated` o `transferred`;
- cobertura mínima del 50% en cada dominio comunicativo disponible: Speaking, Listening, Reading, Writing y Communication;
- al menos un Meta-Can-Do A2 dominado.

### A2+
- mínimo 70% de los Can-Dos A2+ dominados;
- mínimo 50% por dominio comunicativo disponible;
- depende además de haber alcanzado el gate A2.

### B1
- mínimo 65% de los Can-Dos B1 dominados;
- mínimo 50% por dominio comunicativo disponible;
- al menos un Meta-Can-Do B1 dominado;
- depende de haber alcanzado A2 y A2+.

Esto evita que una persona con Grammar muy fuerte pero Speaking muy débil sea clasificada simplemente como B1.

## 4. Perfil por habilidad

La capa conserva el rendimiento separado por habilidad. Un perfil puede mostrar, por ejemplo:

- Speaking: A2+
- Listening: B1 developing
- Reading: B1
- Writing: A2+
- Communication: A2+

El estado global no debe ocultar estas diferencias.

## 5. Retention

El dominio no se borra automáticamente porque pase el tiempo.

En su lugar, cada Can-Do puede tener:

- `current`: revisión no vencida;
- `due`: corresponde revisar;
- `atRisk`: revisión significativamente atrasada;
- `unscheduled`: todavía no existe revisión programada.

Una capacidad `consolidated` o `transferred` puede permanecer así aunque esté `due`. Si una nueva evidencia demuestra deterioro, el Learning Engine vuelve a calcular el estado.

Esto evita el error de confundir **tiempo sin practicar** con **pérdida demostrada de competencia**.

## 6. Intervalos de mantenimiento

Política inicial:

| Estado | Intervalo recomendado |
|---|---:|
| notStarted | 1 día |
| emerging | 1 día |
| developing | 2 días |
| functional | 7 días |
| consolidated | 30 días |
| transferred | 60 días |

Un fallo o evidencia no independiente vuelve a intervalos cortos de recuperación.

Los intervalos son una recomendación para el planner, no una modificación automática del mastery.

## 7. Retención ≠ repetición infinita

HODIE puede seguir practicando una capacidad después de dominarla, pero no debe ocupar toda la agenda con ella.

El planner debe equilibrar:

`new learning + recovery + review + transfer`

Una capacidad transferida puede recibir revisiones más espaciadas mientras aparecen nuevas necesidades.

## 8. API de la capa

`src/progression-retention.js` expone:

- `evaluateLevel()`
- `evaluateProgression()`
- `getRetentionState()`
- `getRetentionPlan()`
- `getRetentionProfile()`

La función `evaluateProgression()` devuelve nivel actual, readiness, análisis por nivel y próximo objetivo.

## 9. Límites deliberados

Esta fase **no**:

- certifica CEFR;
- elimina evidencia;
- degrada automáticamente un Can-Do por tiempo;
- reemplaza el Learning Engine;
- crea actividades;
- decide por número de lecciones.

La siguiente integración futura será conectar esta capa con el Adaptive Planner para que la retención y la progresión influyan en la selección de la siguiente actividad.

## 10. Gate de Phase 3

Phase 3 queda lista cuando:

- existe política explícita A2 → A2+ → B1;
- el perfil por habilidad se mantiene separado;
- mastery y readiness no se confunden;
- retention tiene estados explícitos;
- el tiempo no elimina dominio por sí solo;
- existen pruebas deterministas;
- CI valida la nueva capa.
