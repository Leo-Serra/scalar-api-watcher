# 00 — Inizializzazione Progetto

## Prerequisiti

```bash
node --version    # >= 22
npm --version     # >= 10
ng version        # Angular CLI >= 21  →  npm install -g @angular/cli@latest
firebase --version # >= 13            →  npm install -g firebase-tools
```

---

## 1. Clona il repo e crea il progetto Angular

```bash
# Clona il repo vuoto da GitHub
git clone https://github.com/<tuo-utente>/api-watcher-ng.git
cd api-watcher-ng

# Crea il progetto Angular nella cartella corrente (il . evita di creare una sottocartella)
ng new api-watcher-ng --routing --style=scss --ssr=false --directory .
```

> Se Angular CLI chiede conferma per sovrascrivere la cartella esistente, rispondi `y`.

---

## 2. Installa dipendenze frontend

```bash
npm install firebase @angular/fire
npm install @ngrx/signals @ngrx/operators
npm install tailwindcss postcss autoprefixer
npx tailwindcss init
```

**`tailwind.config.js`** (generato da `init`, aggiorna il campo `content`):
```js
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: { extend: {} },
  plugins: [],
};
```

Aggiungi in `src/styles.scss`:
```scss
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 3. Inizializza Firebase nel repo

```bash
# Login (se non già fatto)
firebase login

# Inizializza Firebase — ti verrà chiesto cosa configurare
firebase init
```

Nella procedura guidata seleziona:
- **Firestore** ✓
- **Functions** ✓ (TypeScript, Node 22)
- **Hosting** ✓ (public dir: `dist/api-watcher-ng/browser`, SPA rewrite: yes)
- **Storage** ✓

Questo crea:
```
.firebaserc
firebase.json
firestore.rules
firestore.indexes.json
storage.rules
functions/
  package.json
  tsconfig.json
  src/
    index.ts
```

---

## 4. Installa dipendenze Cloud Functions

```bash
cd functions
npm install firebase-admin firebase-functions node-fetch
npm install -D typescript @types/node
cd ..
```

---

## 5. Inserisci le credenziali Firebase

Vai su [Firebase Console](https://console.firebase.google.com) → Project Settings → Web app → copia la config.

Modifica `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },
};
```

Fai lo stesso per `src/environments/environment.prod.ts`.

---

## 6. Primo commit

```bash
git add .
git commit -m "feat: initial Angular 21 + Firebase + NgRx setup"
git push origin main
```

---

## 7. Avvia in locale

```bash
# Frontend
ng serve

# Emulatori Firebase (opzionale ma utile in sviluppo)
firebase emulators:start --only auth,firestore,storage,functions
```

Per usare gli emulatori nel frontend aggiungi a `app.config.ts`:
```typescript
import { connectFirestoreEmulator, getFirestore } from '@angular/fire/firestore';
import { connectAuthEmulator, getAuth } from '@angular/fire/auth';
import { connectStorageEmulator, getStorage } from '@angular/fire/storage';

// Solo in development
if (!environment.production) {
  provideFirebaseApp(() => {
    const app = initializeApp(environment.firebase);
    connectFirestoreEmulator(getFirestore(app), 'localhost', 8080);
    connectAuthEmulator(getAuth(app), 'http://localhost:9099');
    connectStorageEmulator(getStorage(app), 'localhost', 9199);
    return app;
  });
}
```

---

## 8. Build e deploy produzione

```bash
# Build frontend
ng build --configuration production

# Deploy tutto (hosting + functions + rules)
firebase deploy

# Deploy selettivi
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules,storage
```

---

## Struttura finale del repo

```
api-watcher-ng/
├── src/                        # Angular app
├── functions/                  # Cloud Functions
├── dist/                       # Build output (gitignored)
├── .firebaserc
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── tailwind.config.js
├── angular.json
├── package.json
└── tsconfig.json
```

Aggiungi al `.gitignore`:
```
dist/
.env
functions/lib/
```
