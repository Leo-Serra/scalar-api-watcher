# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Angular 21 app ("api-watcher-ng") — a port of a Node.js tool into Angular + Firebase + NgRx Signal Store. Watches API specs for changes, diffs versions, and tracks user reading progress.

Target stack: Angular 21 standalone components, NgRx Signal Store (`@ngrx/signals`), Firebase (Auth, Firestore, Cloud Functions, Hosting).

## Commands

- `npm start` / `ng serve` — dev server at localhost:4200
- `npm run build` / `ng build` — production build to `dist/`
- `npm test` / `ng test` — unit tests (Vitest via `@angular/build:unit-test`)

## Architecture

- **State management**: Each feature gets its own `SignalStore` using `withState()`, `withComputed()`, `withMethods()`, `withHooks()`. Components inject stores directly — no separate selectors/actions files.
- **Components**: All standalone, SCSS styles, `app` prefix for selectors.
- **Routing**: Configured in `src/app/app.routes.ts`, provided via `provideRouter` in `src/app/app.config.ts`.

## Code Conventions

- TypeScript strict mode with `strictTemplates` enabled
- Prettier: 100 char width, single quotes, Angular HTML parser
- Use Angular signals (not RxJS subjects) for component state
- Component files: `name.ts`, `name.html`, `name.scss`, `name.spec.ts` (no `.component` suffix — Angular 21 convention)

## Implementation Docs

Design docs live in `~/Downloads/docs/` (numbered `00-init.md` through `10-settings.md`). Follow the implementation order defined in the README.