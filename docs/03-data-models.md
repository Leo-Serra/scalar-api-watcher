# 03 — Modelli Dati TypeScript

## Strategia storage

- **Firestore** — metadati leggeri (hash, version, title, endpointCount, timestamp, ref)
- **Cloud Storage** — spec JSON completi e diff changes, sempre
- Nessuna logica ibrida, nessun `storageMode`

---

## `watch-config.model.ts`

```typescript
import { Timestamp } from '@angular/fire/firestore';

export interface WatchConfig {
  id?: string;
  specUrl: string;
  cronSchedule: string;
  extraHeaders: Record<string, string>;
  maxHistory: number;
  createdBy: string;
  createdAt: Timestamp;
}
```

---

## `spec-version.model.ts`

```typescript
import { Timestamp } from '@angular/fire/firestore';

export interface SpecVersion {
  id?: string;
  configId: string;
  hash: string;           // SHA-256, primi 12 char
  version: string;        // da spec.info.version
  title: string;          // da spec.info.title
  endpointCount: number;
  timestamp: Timestamp;
  specRef: string;        // path Cloud Storage: "specs/{configId}/{hash}.json"
}
```

---

## `diff-report.model.ts`

```typescript
import { Timestamp } from '@angular/fire/firestore';

export type ChangeType = 'added' | 'removed' | 'modified';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface DiffSummary {
  endpointsAdded: number;
  endpointsRemoved: number;
  endpointsChanged: number;
  breakingChanges: number;
  fieldsAdded: number;
  fieldsRemoved: number;
  fieldsChanged: number;
}

export interface FieldChange {
  field: string;
  type: ChangeType;
  oldValue?: unknown;
  newValue?: unknown;
  breaking: boolean;
}

export interface EndpointChange {
  path: string;
  method: HttpMethod;
  type: ChangeType;
  breaking: boolean;
  summary?: string;
  fieldChanges?: FieldChange[];
}

export interface DiffReport {
  id?: string;
  configId: string;
  oldVersionId: string;
  newVersionId: string;
  summary: DiffSummary;
  changesRef: string;     // path Cloud Storage: "diffs/{configId}/{reportId}.json"
  generatedAt: Timestamp;
  // Popolato a runtime dopo il download, non persiste in Firestore
  changes?: EndpointChange[];
}
```

---

## `user-progress.model.ts`

```typescript
import { Timestamp } from '@angular/fire/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  lastLogin: Timestamp;
}

export interface ReadProgress {
  configId: string;
  lastSeenVersionId: string | null;
  lastSeenAt: Timestamp;
  viewedReports: string[];
}
```

---

## `firestore.converters.ts`

```typescript
import {
  FirestoreDataConverter,
  DocumentData,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from '@angular/fire/firestore';
import { WatchConfig } from '../models/watch-config.model';
import { SpecVersion } from '../models/spec-version.model';
import { DiffReport } from '../models/diff-report.model';

function makeConverter<T extends { id?: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore({ id, ...data }: T): DocumentData {
      return data as DocumentData;
    },
    fromFirestore(snap: QueryDocumentSnapshot, options: SnapshotOptions): T {
      return { id: snap.id, ...snap.data(options) } as T;
    },
  };
}

export const watchConfigConverter = makeConverter<WatchConfig>();
export const specVersionConverter = makeConverter<SpecVersion>();
export const diffReportConverter  = makeConverter<DiffReport>();
```

---

## Schema Firestore — riepilogo

| Collection | Campi in Firestore | Dati su Storage |
|---|---|---|
| `watchConfigs/{id}` | `specUrl`, `cronSchedule`, `extraHeaders`, `maxHistory`, `createdBy`, `createdAt` | — |
| `specVersions/{id}` | `configId`, `hash`, `version`, `title`, `endpointCount`, `timestamp`, `specRef` | spec JSON |
| `diffReports/{id}` | `configId`, `oldVersionId`, `newVersionId`, `summary`, `changesRef`, `generatedAt` | changes JSON |
| `users/{uid}` | `email`, `displayName`, `lastLogin` | — |
| `users/{uid}/readProgress/{configId}` | `lastSeenVersionId`, `lastSeenAt`, `viewedReports[]` | — |
