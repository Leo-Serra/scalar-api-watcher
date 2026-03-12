# 02 — Configurazione Firebase

## 1. Crea il progetto Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Abilita:
   - **Authentication** → Email/Password ✓ + Google ✓
   - **Firestore** → production mode
   - **Storage** → production mode (solo per spec >800KB)
   - **Hosting**

---

## 2. Environment files

**`src/environments/environment.ts`**
```typescript
export const environment = {
  production: false,
  specSizeThresholdBytes: 800_000, // soglia Firestore → Storage
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

---

## 3. `firebase.json`

```json
{
  "hosting": {
    "public": "dist/api-watcher-ng/browser",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs22"
  }
}
```

---

## 4. Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /specVersions/{doc} {
      allow read: if request.auth != null;
      allow write: if false; // solo Cloud Function
    }

    match /watchConfigs/{configId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.createdBy;
    }

    match /diffReports/{reportId} {
      allow read: if request.auth != null;
      allow write: if false; // solo Cloud Function
    }

    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;

      match /readProgress/{configId} {
        allow read, write: if request.auth.uid == userId;
      }
    }
  }
}
```

---

## 5. Storage Rules (fallback per spec grandi)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /specs/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if false; // solo Cloud Function
    }
    match /diffs/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

---

## 6. Firestore Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "specVersions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "configId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "diffReports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "configId", "order": "ASCENDING" },
        { "fieldPath": "generatedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 7. Deploy

```bash
ng build --configuration production
firebase deploy
# Solo regole durante sviluppo:
firebase deploy --only firestore:rules,storage
```
