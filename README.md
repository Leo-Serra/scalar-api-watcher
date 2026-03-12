# ScalarApiWatcher

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

# api-watcher-ng — Guida al Progetto

Trasposizione di **api-watcher** (Node.js locale) in **Angular 21 + Firebase + NgRx Signal Store**.

## Stack tecnologico

- **Frontend**: Angular 21, standalone components, signals nativi
- **State management**: NgRx Signal Store (`@ngrx/signals`)
- **Backend**: Firebase Cloud Functions (Node 20)
- **Database**: Firestore (spec JSON incluso, fallback Storage se >800KB)
- **Auth**: Firebase Authentication (email/password + Google SSO)
- **Hosting**: Firebase Hosting

## Indice dei documenti

| File                    | Contenuto                                              |
| ----------------------- | ------------------------------------------------------ |
| `01-setup.md`           | Setup Angular 21 + Firebase + NgRx, struttura cartelle |
| `02-firebase-config.md` | Configurazione Firebase, rules, indexes                |
| `03-data-models.md`     | Modelli TypeScript + schema Firestore (spec inline)    |
| `04-diff-engine.md`     | Diff engine in TypeScript puro                         |
| `05-cloud-functions.md` | Cloud Function watcher schedulata                      |
| `06-auth-store.md`      | Auth con NgRx Signal Store                             |
| `07-versions-store.md`  | SpecVersions store + Dashboard component               |
| `08-reports-store.md`   | DiffReports store + Report Viewer                      |
| `09-progress-store.md`  | User progress store (tracking lettura + bookmark)      |
| `10-settings.md`        | Settings UI + WatchConfig store                        |

## Ordine di implementazione

```
1. Setup (01 + 02)
2. Modelli dati (03)
3. Diff engine (04)
4. Cloud Function (05)
5. Auth store (06)
6. Versions store + Dashboard (07)
7. Reports store + Viewer (08)
8. Progress store (09)
9. Settings (10)
```

## Filosofia NgRx Signal Store usata

Ogni feature ha il proprio `SignalStore` con:

- `withState()` — stato reattivo
- `withComputed()` — derivazioni calcolate
- `withMethods()` — azioni/side effects
- `withHooks()` — lifecycle (caricamento iniziale)

I componenti iniettano lo store direttamente, senza boilerplate di selectors/actions separati.
