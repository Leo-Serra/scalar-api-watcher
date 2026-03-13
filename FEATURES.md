# Scalar API Watcher — Funzionalita

## Panoramica

App web per monitorare API specs OpenAPI/Scalar. Rileva automaticamente i cambiamenti, genera diff report e traccia il progresso di lettura dell'utente. Interfaccia in italiano.

## Architettura attuale (in fase di migrazione)

L'app sta migrando da un modello single-tenant (WatchConfig per utente) a un modello **multi-tenant URL-based**: ogni utente si registra, aggiunge i propri URL Scalar, e vede solo i propri dati. I dati oggettivi (versioni, diff) sono condivisi per URL.

Vedi `PLAN.md` per lo stato di avanzamento e `docs/superpowers/specs/2026-03-13-multi-tenant-url-based-design.md` per la spec della migrazione.

---

## 1. Autenticazione

- **Login con email e password** — form con gestione errori in italiano (utente non trovato, password errata, troppi tentativi)
- **Login con Google OAuth** — popup Google
- **Sessione persistente** — Firebase Auth, auto-redirect a dashboard se gia autenticato
- **Guard sulle rotte** — le pagine protette richiedono autenticazione

## 2. Dashboard e Timeline Versioni

- **Sidebar URL** *(dopo migrazione)* — lista degli URL Scalar a cui l'utente e' iscritto, con badge contatore versioni non lette per ciascuno
- **Aggiunta URL** *(dopo migrazione)* — input per incollare un URL Scalar pubblico. Il sistema crea automaticamente il tracciamento
- **Rimozione URL** *(dopo migrazione)* — rimuove l'URL dalla propria lista senza cancellare i dati
- **Timeline verticale** — mostra tutte le versioni catturate di una spec API, ordinate cronologicamente
- **Indicatori visivi** per ogni versione:
  - Arancione con badge "NEW" — versioni non ancora viste
  - Blu con "sei qui" — ultima versione letta dall'utente
  - Grigio — versioni gia viste
- **Info per versione** — titolo API, numero versione, timestamp, conteggio endpoint, hash del contenuto
- **Azioni per versione:**
  - "Spec" — apre un modal con il JSON completo della spec OpenAPI
  - "Diff" — naviga al report delle differenze con la versione precedente
  - "Segna qui" — aggiorna il bookmark di lettura dell'utente
- **Contatore non lette** — badge in alto con il numero di versioni nuove
- **Empty state** *(dopo migrazione)* — messaggio "URL aggiunto, in attesa del primo scan" quando non ci sono ancora dati

## 3. Report Diff

- **Summary cards** — 4 riquadri color-coded con conteggi:
  - Endpoint aggiunti (verde)
  - Endpoint rimossi (rosso)
  - Endpoint modificati (giallo)
  - Breaking changes (arancione)
- **Filtri** — bottoni per filtrare per tipo di cambiamento (tutti, aggiunti, rimossi, modificati, breaking), ognuno con conteggio
- **Endpoint cards** — per ogni endpoint modificato:
  - Badge metodo HTTP colorato (GET, POST, PUT, DELETE, PATCH)
  - Path monospace
  - Descrizione/summary
  - Badge tipo di cambiamento
  - Indicatore breaking change
  - Espandibile per vedere i dettagli campo per campo
- **Dettaglio campi** — tabella con campo modificato, tipo di modifica, valore vecchio e nuovo (JSON), indicatore breaking
- **Mark as viewed** — il report viene automaticamente segnato come visto all'apertura

## 4. Tracciamento Progresso

- **Bookmark di lettura** — l'utente puo segnare dove e' arrivato nella timeline
- **Report visti** — traccia quali diff report l'utente ha gia consultato
- **Contatore non lette** — calcolo automatico delle versioni piu recenti rispetto al bookmark
- **Sincronizzazione real-time** — il progresso e' salvato su Firestore e sincronizzato tra sessioni

## 5. Cloud Function (Backend)

- **Scan automatico** — ogni 60 minuti, per tutti gli URL registrati
- **Deduplicazione** — se la spec non e' cambiata (stesso hash), non viene creata una nuova versione
- **Diff automatico** — quando viene rilevata una nuova versione, il sistema genera automaticamente il report delle differenze
- **Storico illimitato** — tutte le versioni vengono conservate, nessun pruning
- **Rilevamento breaking changes** — identifica automaticamente: endpoint rimossi, parametri required modificati, tipi cambiati, campi required rimossi/aggiunti

## 6. Stack Tecnico

- **Frontend:** Angular 21, standalone components, NgRx Signal Store, Tailwind CSS
- **Backend:** Firebase (Auth, Firestore, Cloud Storage, Cloud Functions, Hosting)
- **Linguaggio:** TypeScript strict mode
- **Test:** Vitest
- **Localizzazione:** Interfaccia in italiano (date, messaggi, errori)
