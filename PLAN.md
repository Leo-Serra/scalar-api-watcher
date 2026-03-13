---
name: Piano di sviluppo API Watcher
description: Piano completo di implementazione in 10+3 fasi per il port Angular 21 + Firebase + NgRx Signal Store. Fasi 1-10 completate (architettura originale). Fasi 11-13 per la migrazione a multi-tenant URL-based.
type: project
---

# Piano di Sviluppo — Scalar API Watcher (Angular 21)

## Context

Port di un tool Node.js CLI (in `old_software/`) verso un'app Angular 21 + Firebase + NgRx Signal Store. L'app monitora API specs OpenAPI, rileva cambiamenti, genera diff reports e traccia il progresso di lettura dell'utente. Il progetto è un greenfield Angular 21 — solo lo skeleton CLI è stato scaffoldato.

I design docs (`docs/00-init.md` → `docs/10-settings.md`) definiscono l'implementazione originale.
Il design doc della migrazione multi-tenant: `docs/superpowers/specs/2026-03-13-multi-tenant-url-based-design.md`.

---

## Stato Avanzamento

| Fase | Descrizione                                    | Stato      |
| ---- | ---------------------------------------------- | ---------- |
| 1    | Setup, dipendenze, Firebase, Tailwind, routing | ✅ Fatto   |
| 2    | Data Models                                    | ✅ Fatto   |
| 3    | Diff Engine                                    | ✅ Fatto   |
| 4    | Cloud Functions                                | ✅ Fatto   |
| 5    | Auth Store + Login                             | ✅ Fatto   |
| 6    | Versions Store + Dashboard                     | ✅ Fatto   |
| 7    | Reports Store + Report Viewer                  | ✅ Fatto   |
| 8    | Progress Store                                 | ✅ Fatto   |
| 9    | Settings / Watch Config                        | ✅ Fatto   |
| 10   | Integrazione & Polish                          | ✅ Fatto   |
| 11   | Migrazione Data Model + Firestore              | ⬜ Da fare |
| 12   | Migrazione Cloud Function                      | ⬜ Da fare |
| 13   | Migrazione Frontend (Stores + UI)              | ⬜ Da fare |

---

## Fasi 1-10 — Architettura Originale

_(Completate — vedi git history per dettagli)_

---

## Fase 11 — Migrazione Data Model + Firestore

Migrazione dal modello `WatchConfig`-centrico al modello `Url`-centrico multi-tenant.

### 11.1 Nuovo model `UrlDoc`

- Creare `src/app/core/models/url.model.ts`
  ```typescript
  interface UrlDoc {
    id?: string; // hash SHA-256 dell'URL
    specUrl: string;
    createdAt: Timestamp;
  }
  ```

### 11.2 Aggiornare `UserProfile`

- In `src/app/core/models/user-progress.model.ts`:
  - Aggiungere campo `subscribedUrls: string[]` a `UserProfile`

### 11.3 Aggiornare `ReadProgress`

- Rinominare `configId` → `urlHash` in `ReadProgress`

### 11.4 Aggiornare `SpecVersion`

- In `src/app/core/models/spec-version.model.ts`:
  - Rinominare `configId` → `urlHash`

### 11.5 Aggiornare `DiffReport`

- In `src/app/core/models/diff-report.model.ts`:
  - Rinominare `configId` → `urlHash`

### 11.6 Eliminare `WatchConfig`

- Eliminare `src/app/core/models/watch-config.model.ts`

### 11.7 Aggiornare Firestore converters

- In `src/app/core/services/firestore.converters.ts`:
  - Rimuovere `watchConfigConverter`
  - Aggiungere `urlDocConverter`

### 11.8 Aggiornare Firestore Rules

- In `firestore.rules`:
  - Rimuovere rules per `/watchConfigs/`
  - Aggiungere rules per `/urls/{urlHash}`: read = autenticato, create = autenticato, update/delete = nessuno
  - Aggiornare rules per `/urls/{urlHash}/versions/*`: read = autenticato, write = nessuno
  - Aggiornare rules per `/urls/{urlHash}/diffReports/*`: read = autenticato, write = nessuno
  - Mantenere rules per `/users/{uid}/**`: solo proprietario

### 11.9 Semplificare Firestore Indexes

- In `firestore.indexes.json`:
  - Rimuovere indici compositi `(configId, timestamp)` e `(configId, generatedAt)` — non servono piu perche le subcollections sono gia scoped per URL
  - Firestore indicizza automaticamente i singoli campi, quindi `timestamp` e `generatedAt` non richiedono indici espliciti
  - Se servono query ordinate (es. `orderBy('timestamp', 'desc')`), il single-field index automatico basta

**File da modificare:** `url.model.ts` (nuovo), `user-progress.model.ts`, `spec-version.model.ts`, `diff-report.model.ts`, `firestore.converters.ts`, `firestore.rules`, `firestore.indexes.json`
**File da eliminare:** `watch-config.model.ts`

---

## Fase 12 — Migrazione Cloud Function

### 12.1 Aggiornare `watcher.fn.ts`

- Cambiare iterazione: da `watchConfigs` a `urls` collection
- Per ogni doc in `/urls/`:
  - Fetch spec dall'URL pubblico (no headers custom)
  - Hash del contenuto → dedup
  - Save spec su Cloud Storage
  - Creare doc in `/urls/{urlHash}/versions/`
  - Compute diff con versione precedente
  - Creare report in `/urls/{urlHash}/diffReports/`
- Rimuovere logica di pruning (storico illimitato)
- Rimuovere gestione headers custom
- Cron fisso a 60 minuti (invariato)
- **Nota:** le query su versions/diffReports diventano subcollection queries — rimuovere i filtri `where('configId', '==', ...)`, il path della subcollection gia scopa i risultati

### 12.2 Aggiornare Cloud Storage paths

- Aggiornare i path di storage da `specs/${configId}/` a `specs/${urlHash}/` e da `diffs/${configId}/` a `diffs/${urlHash}/`

### 12.3 Aggiornare diff engine (entrambe le copie)

- In `functions/src/diff-engine.ts` e `src/app/core/services/diff-engine.ts`:
  - Rinominare parametro `configId` → `urlHash` nella signature di `computeDiff`
  - Rinominare campo `configId` → `urlHash` nell'interfaccia `DiffResult`

**File da modificare:** `functions/src/watcher.fn.ts`, `functions/src/diff-engine.ts`, `src/app/core/services/diff-engine.ts`

---

## Fase 13 — Migrazione Frontend (Stores + UI)

### 13.1 Eliminare WatchConfig layer

- Eliminare `src/app/core/services/watch-config.service.ts`
- Eliminare `src/app/store/watch-config.store.ts`
- Eliminare `src/app/features/settings/` (intera cartella)

### 13.2 Creare `UrlService`

- `src/app/core/services/url.service.ts`
  - `getUrl(urlHash)` — singolo doc da `/urls/{urlHash}`
  - `getUrls(urlHashes: string[])` — batch di doc
  - `createUrl(specUrl: string)` — calcola hash SHA-256, crea doc con `setDoc({ merge: true })` per gestire race condition (due utenti che aggiungono lo stesso URL contemporaneamente), ritorna urlHash
  - Helper: `hashUrl(url: string): Promise<string>` — SHA-256 hex via `crypto.subtle.digest` (async nel browser)

### 13.3 Creare `UrlsStore`

- `src/app/store/urls.store.ts`
  - State: `urls: UrlDoc[]`, `loading: boolean`
  - Methods: `loadUrls(urlHashes: string[])` — carica doc da Firestore
  - Computed: `urlMap` — `Record<string, string>` (urlHash → specUrl)

### 13.4 Aggiornare `AuthStore`

- In `src/app/store/auth.store.ts`:
  - State: aggiungere `subscribedUrls: string[]`
  - Computed: aggiungere `hasUrls`
  - Methods: aggiungere `subscribeToUrl(url: string)` e `unsubscribeFromUrl(urlHash: string)`
  - `subscribeToUrl`: chiama `UrlService.createUrl()`, poi `arrayUnion` su profilo utente
  - `unsubscribeFromUrl`: `arrayRemove` su profilo utente
  - Aggiungere `_loadProfile()`: su auth state change, legge il doc utente da Firestore e popola `subscribedUrls` nello state (attualmente `_saveProfile` scrive ma nulla rilegge)
  - `_saveProfile()`: inizializza `subscribedUrls: []` solo alla prima creazione del profilo (non a ogni login). Le modifiche successive passano via `arrayUnion`/`arrayRemove`

### 13.5 Aggiornare `SpecVersionService`

- In `src/app/core/services/spec-version.service.ts`:
  - `getVersions$(urlHash)` — query su `/urls/{urlHash}/versions/`
  - Rimuovere filtro `where('configId', ...)` — la subcollection e' gia scoped
  - Aggiornare path Firestore

### 13.6 Aggiornare `VersionsStore`

- In `src/app/store/versions.store.ts`:
  - Rinominare `activeConfigId` → `activeUrlHash`
  - `loadVersions(urlHash)`, `setActiveUrl(urlHash)`
  - Rimuovere `onInit` che carica `loadVersions('default')` — nel nuovo modello non c'e' un default, il dashboard imposta l'URL attivo quando l'utente seleziona dalla sidebar

### 13.7 Aggiornare `DiffReportService`

- In `src/app/core/services/diff-report.service.ts`:
  - `getReport(urlHash, oldVersionId, newVersionId)` — query su `/urls/{urlHash}/diffReports/`
  - `getReportById(urlHash, reportId)` — ora richiede `urlHash` perche i report vivono in subcollections. Il path diventa `/urls/{urlHash}/diffReports/{reportId}`
  - Rimuovere filtro `where('configId', ...)` — la subcollection e' gia scoped

### 13.8 Aggiornare `ReportsStore`

- In `src/app/store/reports.store.ts`:
  - `configId` → `urlHash` ovunque

### 13.9 Aggiornare `UserProgressService`

- In `src/app/core/services/user-progress.service.ts`:
  - `configId` → `urlHash` nei parametri e nei path Firestore

### 13.10 Aggiornare `ProgressStore`

- In `src/app/store/progress.store.ts`:
  - `configId` → `urlHash` ovunque

### 13.11 Aggiornare Dashboard

- In `src/app/features/dashboard/dashboard.ts` + `.html` + `.scss`:
  - Aggiungere **sidebar** a sinistra:
    - Lista URL iscritti (da `authStore.subscribedUrls` + `urlsStore.urlMap`)
    - Badge unread count per URL (da `progressStore`)
    - Bottone "Aggiungi URL" → input per incollare URL Scalar
    - Bottone rimuovi per ogni URL
  - Area principale: timeline versioni dell'URL selezionato
  - **Empty state**: quando un URL e' appena aggiunto e la Cloud Function non ha ancora processato, mostrare messaggio "URL aggiunto, in attesa del primo scan" (non timeline vuota senza spiegazione)
  - Navigazione "Diff": passare `urlHash` come query param insieme a `oldVersionId`/`newVersionId` (era `configId`)
  - Rimuovere bottone "Settings" dalla navbar

### 13.12 Aggiornare Report Viewer

- In `src/app/features/report-viewer/report-viewer.ts`:
  - Leggere `urlHash` (era `configId`) dai query params
  - Passare `urlHash` a `DiffReportService.getReportById(urlHash, reportId)`
  - Passare `urlHash` a `progressStore.markReportViewed()`

### 13.13 Aggiornare Routing

- In `src/app/app.routes.ts`:
  - Rimuovere rotta `/settings`
  - Rotte finali: `/login`, `/dashboard`, `/report/:reportId`, `/` → redirect

### 13.14 Aggiornare test

- Aggiornare `diff-engine.spec.ts`: riferimenti `configId` → `urlHash`
- Aggiornare eventuali test di stores e services che usano `configId`

### 13.15 Aggiornare struttura cartelle

- Rimuovere `src/app/features/settings/`
- Struttura finale:
  ```
  src/app/
  ├── core/models/        (url.model.ts al posto di watch-config.model.ts)
  ├── core/services/      (url.service.ts al posto di watch-config.service.ts)
  ├── core/guards/
  ├── store/              (urls.store.ts al posto di watch-config.store.ts)
  ├── features/login/
  ├── features/dashboard/ (con sidebar integrata)
  ├── features/report-viewer/
  ├── shared/components/
  └── shared/pipes/
  ```

**File da creare:** `url.model.ts`, `url.service.ts`, `urls.store.ts`
**File da modificare:** `auth.store.ts`, `spec-version.service.ts`, `versions.store.ts`, `diff-report.service.ts`, `reports.store.ts`, `user-progress.service.ts`, `progress.store.ts`, `dashboard.ts`, `dashboard.html`, `dashboard.scss`, `report-viewer.ts`, `app.routes.ts`, `diff-engine.spec.ts`
**File da eliminare:** `watch-config.service.ts`, `watch-config.store.ts`, `features/settings/*`

---

## Verifica End-to-End (aggiornata)

1. `npm start` → app si avvia senza errori
2. Login con email/password e Google → redirect a dashboard
3. Dashboard mostra sidebar vuota per utente nuovo
4. "Aggiungi URL" → inserire URL Scalar → appare nella sidebar
5. Al prossimo ciclo Cloud Function (o con dati seed): versioni appaiono nella timeline
6. Click "Diff" → navigazione a report viewer con filtri funzionanti
7. Click "Segna come letto" → progresso aggiornato, badge scompaiono
8. Rimuovi URL → sparisce dalla sidebar, dati restano in Firestore
9. Secondo utente aggiunge stesso URL → vede gli stessi dati, progress indipendente
10. `npm test` → tutti i test passano
11. `npm run build` → build di produzione senza errori
12. Cloud Function itera su `/urls/` e processa correttamente
