# 01 — Setup Progetto

## Prerequisiti

```bash
node -v       # >= 22 (Angular 21 richiede Node 22+)
npm -v        # >= 10
ng version    # Angular CLI >= 21
firebase --version  # Firebase CLI >= 13
```

```bash
npm install -g @angular/cli@latest firebase-tools
```

---

## 1. Crea il progetto Angular 21

```bash
ng new api-watcher-ng \
  --routing \
  --style=scss \
  --ssr=false

cd api-watcher-ng
```

---

## 2. Installa dipendenze

```bash
# Firebase + AngularFire
npm install firebase @angular/fire

# NgRx Signal Store
npm install @ngrx/signals

# UI
npm install tailwindcss postcss autoprefixer
npx tailwindcss init
```

**`tailwind.config.js`**:
```js
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: { extend: {} },
  plugins: [],
};
```

**`src/styles.scss`**:
```scss
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 3. Struttura cartelle

```
src/
├── app/
│   ├── core/
│   │   ├── models/
│   │   │   ├── watch-config.model.ts
│   │   │   ├── spec-version.model.ts
│   │   │   ├── diff-report.model.ts
│   │   │   └── user-progress.model.ts
│   │   ├── services/
│   │   │   ├── spec-version.service.ts
│   │   │   ├── diff-report.service.ts
│   │   │   ├── watch-config.service.ts
│   │   │   ├── user-progress.service.ts
│   │   │   ├── diff-engine.ts
│   │   │   └── firestore.converters.ts
│   │   └── guards/
│   │       └── auth.guard.ts
│   ├── store/
│   │   ├── auth.store.ts
│   │   ├── versions.store.ts
│   │   ├── reports.store.ts
│   │   ├── progress.store.ts
│   │   └── watch-config.store.ts
│   ├── features/
│   │   ├── login/
│   │   │   └── login.component.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard.component.ts
│   │   │   └── version-timeline/
│   │   │       └── version-timeline.component.ts
│   │   ├── report-viewer/
│   │   │   ├── report-viewer.component.ts
│   │   │   └── endpoint-card/
│   │   │       └── endpoint-card.component.ts
│   │   └── settings/
│   │       └── watch-config.component.ts
│   └── shared/
│       ├── components/
│       │   └── badge.component.ts
│       └── pipes/
│           └── relative-time.pipe.ts
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
functions/
├── src/
│   ├── index.ts
│   ├── watcher.fn.ts
│   └── diff-engine.ts
└── package.json
```

```bash
mkdir -p src/app/core/models src/app/core/services src/app/core/guards
mkdir -p src/app/store
mkdir -p src/app/features/login
mkdir -p src/app/features/dashboard/version-timeline
mkdir -p src/app/features/report-viewer/endpoint-card
mkdir -p src/app/features/settings
mkdir -p src/app/shared/components src/app/shared/pipes
```

---

## 4. `app.routes.ts`

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'report/:reportId',
    loadComponent: () =>
      import('./features/report-viewer/report-viewer.component').then(m => m.ReportViewerComponent),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/watch-config.component').then(m => m.WatchConfigComponent),
    canActivate: [authGuard],
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
```

---

## 5. `app.config.ts`

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
  ],
};
```

---

## 6. Setup Cloud Functions

```bash
firebase init functions
# TypeScript, Node 22, no ESLint
```
