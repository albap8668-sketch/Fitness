# FitnessTracker — Contexto para Claude Code

## Qué es
App web tipo PWA, archivo HTML único (`FitnessTracker.html`, ~4700 líneas), sin frameworks ni build tools (solo Google Fonts y Firebase CDN). Persistencia en `localStorage` + sincronización a Firestore con sesión activa. Alojada en GitHub Pages.

- **Repo**: `albap8668-sketch/Fitness` (rama `main`) — **público**
- **URL viva**: https://albap8668-sketch.github.io/Fitness/FitnessTracker.html
- **Usuario**: Pedro, 20 años, Salta Argentina. Objetivo: pérdida de grasa + ganancia muscular. La app la usan también sus amigos (multi-usuario).
- **Proyecto Firebase**: `fitness-tracker-b46ad`
- **Admin UID** (hardcodeado en `ADMIN_UID` y en `firestore.rules`): `27kSUTAXhpg7NPO342S7XXPjwHn1`

## Decisión de arquitectura importante
El repo es **público**: la API Key de Gemini **nunca va en el código fuente**. Vive solo en `localStorage` (`geminiKey`), ingresada desde Perfil, excluida de la sincronización y del backup JSON. Las claves de `firebaseConfig` sí están en el código — son públicas por diseño del SDK.

## MODELO DE DATOS (particionado por mes — NO asumir el modelo viejo)
El historial diario **ya no vive en una clave única `days`**. Desde julio 2026:

- **localStorage**: una clave por mes `days_YYYY-MM` (objeto `{fecha: datosDelDía}`) + índice `daysMonths` (array de meses existentes).
- **Firestore**: subcolección `users/{uid}/months/{YYYY-MM}`, cada doc `{days: {...}, updatedAt}`. Evita el techo de 1MB/documento.
- **`getDays()`** devuelve la vista completa fusionada (cache en memoria `_daysCache`, se arma una vez por sesión). Streak, gráficos, export y agregaciones la consumen igual que antes.
- **`saveDays(allDays, [fechas])`** escribe y sube SOLO los meses de las fechas tocadas. Nunca usar `ss("days",...)` ni `syncToCloud("days",...)` — ya no existen call sites.
- **Migración automática e idempotente** (`migrateDaysToMonths`): al detectar la clave vieja `days`, particiona, **verifica releyendo cada mes contra el original** y recién ahí borra la clave vieja. Si se interrumpe, reintenta desde cero en la próxima carga (las escrituras por mes son deterministas, no duplica). En la nube igual (`syncFromCloud`): batch atómico que escribe los docs de meses Y borra el campo `days` juntos.
- **`SYNC_KEYS`** ya NO incluye `days`: `["profile","customFoods","customExercises","foodIdCounter","userRoutine","weightHistory","savedRoutines"]`. Los meses se sincronizan aparte (`syncMonthToCloud`; al reconectar, el handler `online` itera `getMonthList()`).
- Agregaciones separadas de la UI: `aggregateMonth("YYYY-MM")` y `aggregateYear("YYYY")`.

## Firestore
- SDK compat v10.13.0 vía CDN — NO modular/npm. Persistencia offline habilitada (`enablePersistence`).
- Colecciones:
  - `users/{uid}` — datos personales (claves de SYNC_KEYS, merge strategy)
  - `users/{uid}/months/{YYYY-MM}` — historial particionado
  - `leaderboard/{uid}` — ranking semanal del grupo (lectura: cualquier autenticado)
  - `sharedFoods/{docId}` — base de alimentos comunitaria: `{nombre, cal, prot, carb, fat, cat, porciones?, uploadedBy, uploadedAt, source, status}`. `approved` visible para todos; `pending` solo para el que lo subió y el admin. Barcode/Gemini/label/recipe se auto-aprueban; manual pasa por verificación de macros con Gemini antes de compartir.
- Auth: `signInWithPopup` (NO redirect — falló en iOS PWA standalone).
- Reglas en `firestore.rules` (deployar con `firebase deploy --only firestore:rules --project fitness-tracker-b46ad`).

## Features principales
- **HOY**: registro conversacional con IA (campo "Contá qué comiste" + dictado `webkitSpeechRecognition`, parseo Gemini a JSON estricto con confianza por ítem, modal de confirmación de un toque, doble destino: día + Despensa/sharedFoods con porciones aprendidas). Buscador local (~470 alimentos con cortes de carne USDA y regionales de toda Argentina con tags de sinónimos y metadato `reg`), sharedFoods (badge ☁️), foto de plato y etiqueta nutricional (→ Despensa), código de barras (Open Food Facts, auto-comparte).
- **GYM**: rutinas múltiples, cronómetros basados en timestamp que sobreviven suspensión de la PWA (descanso: `restTimerEnd` en localStorage, beep Web Audio desbloqueado en el tap inicial, vibración si existe, notificación vía SW en background; sesión: `gymSessionStart`, botón "Finalizar sesión", auto-cierre a las 4h sin actividad). Pill flotante visible en cualquier pestaña.
- **SEMANA ("Progreso")**: selector Semana/Mes/Año. Mes: calendario + stats + gráficos diarios. Año: 12 barras mensuales (kcal prom, días entrenados, volumen gym) + evolución de peso.
- **DESPENSA**: CRUD, botón ☁️ "compartir con todos", receta calculadora (🧪), importación desde etiqueta.
- **PERFIL**: BMR/TDEE, login Google (muestra UID), API Key Gemini, export CSV, **backup completo JSON** (`exportarBackupJSON`, excluye geminiKey), **Zona peligrosa: Eliminar mi cuenta** (`deleteMyAccount`: confirmación escribiendo ELIMINAR, anonimiza `uploadedBy:"deleted"` en sharedFoods, borra subcolección months explícitamente —Firestore no borra subcolecciones solo—, borra doc de usuario + leaderboard, `user.delete()` con manejo de `auth/requires-recent-login` vía `reauthenticateWithPopup`, `localStorage.clear()` y despedida).

## Funciones clave
- `ls(k,d)` / `ss(k,v)` — helpers localStorage
- `getDays()` / `saveDays(allDays,[fechas])` / `getDayData(date)` / `saveDayData(date,data)`
- `aggregateMonth(ym)` / `aggregateYear(yyyy)` — agregación pura, sin UI
- `getAllFoods()` / `searchFoods(q)` — incluye tags de sinónimos y porciones aprendidas (`_gu/_gpU/_allowed`)
- `loadSharedFoods()` (cache 5 min) / `addToSharedFoods(food,source)` / `shareCustomFood(id)`
- `parseNaturalFood()` / `confirmNLItems()` — registro conversacional
- `geminiPost(key,body)` — intenta `gemini-2.5-flash` → `gemini-2.0-flash` en 503/429
- `renderBarChart(id,data,series,unit)` — generalizado a N grupos (7/31/12), flag `isToday` por dato
- `showToast(msg,type)` — auto-oculta 2,5s (oculta con opacity+visibility, no solo transform: en iPhone con notch el translateY no alcanzaba)

## Service Worker / PWA
- `sw.js` v6, cache `fitness-v6`, network-first, auto-update con recarga silenciosa, handler `notificationclick`.

## Lo que se intentó y NO funcionó
- Supabase: falló en Safari iOS. No reintentar.
- `signInWithRedirect`: volvía a Safari en vez de a la PWA. Usar `signInWithPopup`.
- Extraer la base de alimentos a `foods-db.json`: evaluado y descartado por ahora (acceso síncrono + single-file deliberado). Reconsiderar si supera ~1000 entradas.

## Cloud Functions
Código listo pero pausado hasta activar plan Blaze (ver memoria del proyecto).

## División de responsabilidades
**Claude Code hace:** todo el código, git add/commit, actualizar este archivo cuando cambia el modelo de datos.

**Pedro hace manualmente:**
1. `git push` desde PowerShell (pasarle siempre el comando exacto: `cd Documents\fitness-tracker` → `git push`).
2. `firebase deploy --only firestore:rules --project fitness-tracker-b46ad` cuando cambian las reglas.
3. Consola de Firebase para configuración.
4. API Key de Gemini en la pestaña Perfil (nunca en chat ni código).
5. Probar en iPhone real.
