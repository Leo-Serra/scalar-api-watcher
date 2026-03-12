---
name: Piano di sviluppo API Watcher
description: Piano completo di implementazione in 10 fasi per il port Angular 21 + Firebase + NgRx Signal Store. Include stato di avanzamento per ogni fase.
type: project
---

# Piano di Sviluppo — Scalar API Watcher (Angular 21)

## Context

Port di un tool Node.js CLI (in `old_software/`) verso un'app Angular 21 + Firebase + NgRx Signal Store. L'app monitora API specs OpenAPI, rileva cambiamenti, genera diff reports e traccia il progresso di lettura dell'utente. Il progetto è un greenfield Angular 21 — solo lo skeleton CLI è stato scaffoldato.

I design docs (`docs/00-init.md` → `docs/10-settings.md`) definiscono ogni aspetto dell'implementazione.

---

## Stato Avanzamento

| Fase | Descrizione | Stato |
|------|-------------|-------|
| 1 | Setup, dipendenze, Firebase, Tailwind, routing | ✅ Fatto |
| 2 | Data Models | ✅ Fatto |
| 3 | Diff Engine | ✅ Fatto |
| 4 | Cloud Functions | ✅ Fatto |
| 5 | Auth Store + Login | ⬜ Da fare |
| 6 | Versions Store + Dashboard | ⬜ Da fare |
| 7 | Reports Store + Report Viewer | ⬜ Da fare |
| 8 | Progress Store | ⬜ Da fare |
| 9 | Settings / Watch Config | ⬜ Da fare |
| 10 | Integrazione & Polish | ⬜ Da fare |

---

## Fase 1 — Setup & Dipendenze (`docs/00-init.md`, `docs/01-setup.md`, `docs/02-firebase-config.md`)

### 1.1 Installare dipendenze frontend
```
npm install firebase @angular/fire @ngrx/signals @ngrx/operators
npm install -D tailwindcss postcss autoprefixer
```

### 1.2 Configurare Tailwind CSS
- Creare `tailwind.config.js` con content paths per `src/`
- Aggiungere direttive Tailwind in `src/styles.scss`

### 1.3 Creare file environment
- `src/environments/environment.ts` (dev, con emulatori)
- `src/environments/environment.prod.ts` (prod)
- Entrambi con: `production`, `specSizeThresholdBytes`, `firebase: { ... }`

### 1.4 Configurare Firebase
- `firebase.json` (hosting, firestore, storage, functions)
- `.firebaserc` (project alias)
- `firestore.rules` (security rules per collection)
- `firestore.indexes.json` (indici compositi)
- `storage.rules` (rules per specs/ e diffs/)

### 1.5 Configurare `app.config.ts`
- Aggiungere `provideFirebaseApp`, `provideAuth`, `provideFirestore`, `provideStorage` da `@angular/fire`
- Aggiungere `provideHttpClient`
- Configurare `provideRouter` con `withComponentInputBinding()`

### 1.6 Creare struttura cartelle
```
src/app/
├── core/models/
├── core/services/
├── core/guards/
├── store/
├── features/login/
├── features/dashboard/
├── features/report-viewer/
├── features/settings/
├── shared/components/
└── shared/pipes/
```

### 1.7 Configurare routing (`app.routes.ts`)
- `/login` → LoginComponent
- `/dashboard` → DashboardComponent (authGuard)
- `/report/:reportId` → ReportViewerComponent (authGuard)
- `/settings` → WatchConfigComponent (authGuard)
- `/` → redirect a `/dashboard`

**File da modificare:** `package.json`, `src/styles.scss`, `src/app/app.config.ts`, `src/app/app.routes.ts`, `angular.json`
**File da creare:** `tailwind.config.js`, `src/environments/environment.ts`, `src/environments/environment.prod.ts`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`

---

## Fase 2 — Data Models (`docs/03-data-models.md`)

Creare le interfacce TypeScript:

- `src/app/core/models/watch-config.model.ts` — `WatchConfig`
- `src/app/core/models/spec-version.model.ts` — `SpecVersion`
- `src/app/core/models/diff-report.model.ts` — `DiffReport`, `DiffSummary`, `EndpointChange`, `FieldChange`, `ChangeType`, `HttpMethod`
- `src/app/core/models/user-progress.model.ts` — `UserProfile`, `ReadProgress`
- `src/app/core/services/firestore.converters.ts` — `makeConverter<T>()` generico

---

## Fase 3 — Diff Engine (`docs/04-diff-engine.md`)

- `src/app/core/services/diff-engine.ts` — Logica pura TypeScript (no Angular deps)
- Portare da `old_software/api-watcher_old/src/diff-engine.js`:
  - `flattenSchema()` con risoluzione `$ref` e gestione `allOf/anyOf/oneOf`
  - `getEndpoints()`, `diffFields()`, `compareSpecs()`
  - Regole breaking changes (endpoint rimosso, parametro required rimosso/aggiunto, tipo cambiato, campo required rimosso/aggiunto)
- Funzione principale: `computeDiff(oldSpec, newSpec, configId, oldVersionId, newVersionId) → DiffReport`
- Deve funzionare sia nel frontend che nelle Cloud Functions

---

## Fase 4 — Cloud Functions (`docs/05-cloud-functions.md`)

### 4.1 Setup Functions
- Creare `functions/` con `package.json`, `tsconfig.json`
- `npm install firebase-admin firebase-functions node-fetch js-yaml`

### 4.2 Implementare
- `functions/src/index.ts` — Export della function
- `functions/src/watcher.fn.ts` — `watcherScheduled` (onSchedule, ogni 60 min, Europe/Rome)
  - Per ogni WatchConfig: fetch spec → hash → dedup → save to Storage → save metadata → compute diff → save report → prune history
- `functions/src/diff-engine.ts` — Copia condivisa del diff engine

---

## Fase 5 — Auth Store + Login (`docs/06-auth-store.md`)

- `src/app/store/auth.store.ts` — NgRx Signal Store
  - State: `user`, `loading`, `error`, `initialized`
  - Computed: `isLoggedIn`, `uid`, `displayName`, `email`
  - Methods: `initAuthListener`, `loginWithEmail`, `loginWithGoogle`, `logout`, `clearError`
  - Helper: `_saveProfile()` → Firestore `users/{uid}`
  - Error mapping Firebase → messaggi italiani
- `src/app/core/guards/auth.guard.ts` — `CanActivateFn`
- `src/app/features/login/login.ts` — Form email/password + Google OAuth
- `src/app/features/login/login.html` — Template Tailwind
- `src/app/features/login/login.scss`

**Verifica:** Login con email/password, login con Google, redirect a dashboard, guard blocca accesso non autenticato.

---

## Fase 6 — Versions Store + Dashboard (`docs/07-versions-store.md`)

### 6.1 Service
- `src/app/core/services/spec-version.service.ts`
  - `getVersions$(configId)` — Observable da Firestore
  - `resolveSpecJson(version)` — Download da Cloud Storage

### 6.2 Store
- `src/app/store/versions.store.ts`
  - State: `versions`, `activeConfigId`, `loadingVersions`, `previewVersion`, `previewJson`, `previewLoading`, `error`
  - Computed: `hasVersions`, `latestVersion`
  - Methods: `loadVersions`, `openSpecPreview`, `closeSpecPreview`, `setActiveConfig`

### 6.3 Components
- `src/app/features/dashboard/dashboard.ts` + `.html` + `.scss`
  - Navbar con email utente e logout
  - Contatore versioni non lette (da ProgressStore)
  - Bottone settings
  - `<app-version-timeline>` con input/output
  - Modal overlay per preview JSON spec
- `src/app/features/dashboard/version-timeline/version-timeline.ts` + `.html` + `.scss`
  - Timeline verticale con dot colorati (orange=new, blue=last seen, gray=read)
  - Badge "NEW", indicatore "← sei qui"
  - Bottoni: Spec, Diff, Segna come letto

---

## Fase 7 — Reports Store + Report Viewer (`docs/08-reports-store.md`)

### 7.1 Service
- `src/app/core/services/diff-report.service.ts`
  - `getReport(configId, oldVersionId, newVersionId)`
  - `getReportById(reportId)`
  - `resolveChanges(report)` — Download changes da Storage

### 7.2 Store
- `src/app/store/reports.store.ts`
  - State: `report`, `loading`, `error`, `activeFilter`
  - Computed: `summary`, `filteredChanges`, `countByFilter`
  - Methods: `loadReport`, `setFilter`, `reset`
  - FilterType: `'all' | 'added' | 'removed' | 'modified' | 'breaking'`

### 7.3 Components
- `src/app/features/report-viewer/report-viewer.ts` + `.html` + `.scss`
  - Header con back link
  - Summary chips (4 colonne, color-coded)
  - Bottoni filtro con conteggi
  - Lista `<app-endpoint-card>`
  - On init: carica report da query params, segna come visto
- `src/app/features/report-viewer/endpoint-card/endpoint-card.ts` + `.html` + `.scss`
  - Card espandibile
  - Badge metodo HTTP (color-coded)
  - Path monospace, summary, type badge, breaking indicator
  - Espanso: tabella field changes con old/new values

---

## Fase 8 — Progress Store (`docs/09-progress-store.md`)

### 8.1 Service
- `src/app/core/services/user-progress.service.ts`
  - `getProgress$(uid, configId)` — Observable
  - `updateLastSeen(uid, configId, versionId)`
  - `markReportViewed(uid, configId, reportId)` — usa `arrayUnion`

### 8.2 Store
- `src/app/store/progress.store.ts`
  - State: `progress`, `loading`
  - Computed: `lastSeenVersionId`, `viewedReports`, `unreadCount`
  - Methods: `watchProgress`, `updateLastSeen`, `markReportViewed`

### 8.3 Shared
- `src/app/shared/pipes/relative-time.pipe.ts` — "adesso", "Nm fa", "Nh fa", "ieri", "Ng fa", date it-IT
- `src/app/shared/components/badge/badge.ts` — Componente badge riutilizzabile

---

## Fase 9 — Settings / Watch Config (`docs/10-settings.md`)

### 9.1 Service
- `src/app/core/services/watch-config.service.ts`
  - `getConfigs$()` — Observable
  - `create(data, uid)`
  - `delete(id)`

### 9.2 Store
- `src/app/store/watch-config.store.ts`
  - State: `configs`, `loading`, `saving`, `error`
  - Methods: `loadConfigs`, `addConfig`, `removeConfig`

### 9.3 Component
- `src/app/features/settings/watch-config.ts` + `.html` + `.scss`
  - Lista config esistenti (read-only con delete)
  - Form per aggiungere nuova config:
    - URL spec OpenAPI (required)
    - Cron schedule (default: `0 * * * *`)
    - Max history (5-200, default: 50)
    - Headers HTTP custom (lista dinamica key-value)

---

## Fase 10 — Integrazione & Polish

- Collegare ProgressStore al Dashboard (contatore unread, indicatori timeline)
- Collegare ReportsStore al flusso "Diff" dal Dashboard
- Verificare flusso completo: login → dashboard → view spec → view diff → mark as read → settings
- Configurare Prettier (100 char, single quotes, Angular HTML parser)
- Test unitari per diff engine e stores
- Deploy su Firebase Hosting

---

## Verifica End-to-End

1. `npm start` → app si avvia senza errori
2. Login con email/password e Google → redirect a dashboard
3. Dashboard mostra versioni dalla Firestore (serve dati seed o Cloud Function attiva)
4. Click "Diff" → navigazione a report viewer con filtri funzionanti
5. Click "Segna come letto" → progresso aggiornato, badge scompaiono
6. Settings → aggiungere/rimuovere watch config
7. `npm test` → tutti i test passano
8. `npm run build` → build di produzione senza errori
9. Cloud Function watcher esegue correttamente (test con emulatori)
