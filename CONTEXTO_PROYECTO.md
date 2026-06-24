# FitnessTracker — Contexto para Claude Code

## Qué es
App web tipo PWA, archivo HTML único (`FitnessTracker.html`, ~2100 líneas), sin frameworks ni dependencias externas (salvo Google Fonts y Firebase CDN). Persistencia en `localStorage` del navegador + sincronización a Firestore cuando hay sesión activa. Alojada en GitHub Pages.

- **Repo**: `albap8668-sketch/Fitness` (rama `main`) — **público**
- **URL viva**: https://albap8668-sketch.github.io/Fitness/FitnessTracker.html
- **Usuario**: Pedro, 20 años, 78kg, 173cm, Salta Argentina. Objetivo: pérdida de grasa + ganancia muscular.

## Decisión de arquitectura importante
El repo es **público**, así que la API Key de Gemini **nunca debe escribirse en el código fuente**. Se guarda exclusivamente en `localStorage` del navegador, ingresada desde la pestaña Perfil. **`geminiKey` está excluida de `SYNC_KEYS` — nunca se sube a Firestore, queda solo local por diseño.**

Las claves de Firebase (`firebaseConfig`) sí viven en el código fuente — son públicas por diseño del SDK.

## Pestañas de la app

**HOY**: registro diario de comidas y actividad. Selector de fecha, cards de macros/calorías, barras de progreso, toggles de Musculación/Boxeo, 18 actividades extra con cálculo MET, pasos diarios, buscador de alimentos (~350 alimentos locales), sistema de porciones inteligente, botón 📸 para análisis de foto con Gemini, botón "🤖 Buscar con IA" cuando no hay resultados locales.

**GYM**: rutina de 5 días hardcodeada (la rutina real de Pedro). Selector fecha/semana, mejor registro anterior por ejercicio, cálculo kcal (MET), guardar por ejercicio o toda la sesión, ejercicios custom por día. Ejercicios con DS muestran 3 campos por serie (D1/D2/D3). Botón 📈 por ejercicio abre modal de progreso.

**SEMANA**: grid de 7 días, resumen al tocar un día, cards de stats, balance semanal, 3 gráficos SVG (calorías, proteínas, carbos/grasas).

**DESPENSA**: alimentos personalizados del usuario. CRUD completo. Dos modos de creación: macros directos o por ingredientes (autocompletado).

**PERFIL**: datos antropométricos, BMR (Mifflin-St Jeor), TDEE, macros objetivo. Login con Google (Firebase). Campo para API Key de Gemini.

## Funciones clave del código
- `getAllFoods()` / `searchFoods(q)` — búsqueda local en base de alimentos (línea ~1179)
- `doSearch(q)` — renderiza resultados, muestra botón "🤖 Buscar con IA" si no hay resultados locales
- `saveNewFood()` — guarda alimento en despensa (`customFoods` en localStorage)
- `showToast(msg, type)` — notificaciones UI
- `ls(k,d)` / `ss(k,v)` — helpers de localStorage
- `syncToCloud(key, value)` — escribe una clave a Firestore (solo si hay sesión)
- `syncFromCloud()` — lee todas las claves de `SYNC_KEYS` desde Firestore y las escribe a localStorage
- `getExHistory(dayN, exIdx)` — historial de sesiones de un ejercicio con volumen total (incluye drops DS)
- `renderLineChart(data, key, label, color)` — gráfico SVG de línea (reutilizable)
- `renderDSSetBlock()` / `renderNormalSetRow()` — render de series según tipo
- `isDS(schema)` — devuelve true si el schema del ejercicio contiene "DS"

## Firebase / Firestore
- SDK compat v10.13.0 vía CDN (gstatic.com) — NO modular/npm
- `SYNC_KEYS = ["days","profile","customFoods","customExercises","foodIdCounter"]`
- Doc único por usuario: `users/{uid}` con merge strategy
- Auth: `signInWithPopup` (NO redirect — redirect falló en iOS PWA standalone)
- Al loguearse: `syncFromCloud()` trae los datos de la nube y llama `renderHoy()`
- Al guardar cualquier dato: `ss(key, val)` + `syncToCloud(key, val)`

## Service Worker / PWA
- `sw.js` v4, cache `fitness-v4`, estrategia network-first
- Auto-update activado: `reg.update()` en cada carga + listener `updatefound` que recarga la app cuando el nuevo SW toma control
- **No hace falta eliminar y re-agregar el acceso directo para recibir actualizaciones** — ocurre automáticamente

## Lo que se intentó y NO funcionó
- Supabase: falló en Safari iOS ("Invalid supabaseUrl" con CDN). No reintentar.
- `signInWithRedirect`: después del login volvía a Safari en vez de a la PWA. Reemplazado por `signInWithPopup`.

## TODO / Ideas futuras
No hay features pendientes definidas actualmente. Posibles mejoras a discutir:
- Push notifications para recordatorios de registro
- Widget de resumen para iOS (requiere app nativa, no viable con PWA)
- Exportar historial como CSV

## Cómo arrancar en Claude Code
1. Abrí la carpeta `fitness-tracker/` como proyecto.
2. Leé este archivo para entender el contexto.
3. La API Key de Gemini va en la pestaña Perfil de la app — nunca en el chat ni en el código.
4. Para subir cambios: `cd Documents\fitness-tracker` → `git push` (Pedro lo corre desde PowerShell).

## División de responsabilidades
**Claude Code hace:** todo el código, git add/commit. Pedro hace el git push.

**Pedro hace manualmente (no delegar a IA):**
1. Consola de Firebase si hay cambios de configuración.
2. API Key de Gemini: obtenerla en aistudio.google.com/apikey y pegarla en la app.
3. Probar en iPhone real.
