# 04 — Diff Engine in TypeScript

La logica di `diff-engine.js` è pura (nessuna dipendenza Node) e si porta quasi 1:1 in TypeScript. Questo modulo può girare sia nel **frontend** (diff on-demand) sia nella **Cloud Function** (diff automatico).

File condiviso: `src/app/core/services/diff-engine.ts`  
Copia anche in: `functions/src/diff-engine.ts` (o usa path alias / monorepo)

---

## `diff-engine.ts`

```typescript
import {
  DiffSummary,
  DiffReport,
  EndpointChange,
  FieldChange,
  ChangeType,
  HttpMethod,
} from '../models/diff-report.model';

// ─── Tipi interni ────────────────────────────────────────────────────────────

interface OpenApiSpec {
  info?: { title?: string; version?: string };
  paths?: Record<string, PathItem>;
  components?: { schemas?: Record<string, unknown> };
}

interface PathItem {
  [method: string]: OperationObject | unknown;
}

interface OperationObject {
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  deprecated?: boolean;
}

interface ParameterObject {
  name: string;
  in: string;
  required?: boolean;
  schema?: Record<string, unknown>;
}

interface RequestBodyObject {
  required?: boolean;
  content?: Record<string, { schema?: Record<string, unknown> }>;
}

interface ResponseObject {
  description?: string;
  content?: Record<string, { schema?: Record<string, unknown> }>;
}

// ─── HTTP methods riconosciuti ────────────────────────────────────────────────

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function isHttpMethod(key: string): key is HttpMethod {
  return HTTP_METHODS.includes(key.toUpperCase() as HttpMethod);
}

// ─── Endpoint key helper ──────────────────────────────────────────────────────

function endpointKey(path: string, method: string): string {
  return `${method.toUpperCase()} ${path}`;
}

// ─── Estrai tutti gli endpoint da una spec ────────────────────────────────────

function extractEndpoints(
  spec: OpenApiSpec
): Map<string, { path: string; method: HttpMethod; op: OperationObject }> {
  const map = new Map<string, { path: string; method: HttpMethod; op: OperationObject }>();

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem as PathItem)) {
      if (!isHttpMethod(method)) continue;
      const key = endpointKey(path, method);
      map.set(key, { path, method: method.toUpperCase() as HttpMethod, op: operation as OperationObject });
    }
  }

  return map;
}

// ─── Confronto parametri ─────────────────────────────────────────────────────

function diffParameters(
  oldParams: ParameterObject[] = [],
  newParams: ParameterObject[] = []
): FieldChange[] {
  const changes: FieldChange[] = [];
  const oldMap = new Map(oldParams.map(p => [`${p.in}:${p.name}`, p]));
  const newMap = new Map(newParams.map(p => [`${p.in}:${p.name}`, p]));

  for (const [key, newP] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        field: `param:${key}`,
        type: 'added',
        newValue: newP,
        breaking: false,
      });
    }
  }

  for (const [key, oldP] of oldMap) {
    const newP = newMap.get(key);
    if (!newP) {
      changes.push({
        field: `param:${key}`,
        type: 'removed',
        oldValue: oldP,
        // Breaking se era required
        breaking: !!oldP.required,
      });
    } else {
      // Controlla se required è cambiato
      if (!oldP.required && newP.required) {
        changes.push({
          field: `param:${key}:required`,
          type: 'modified',
          oldValue: false,
          newValue: true,
          breaking: true, // aggiungere required è breaking
        });
      }
      // Controlla tipo schema
      const oldType = (oldP.schema as Record<string, unknown>)?.['type'];
      const newType = (newP.schema as Record<string, unknown>)?.['type'];
      if (oldType !== newType) {
        changes.push({
          field: `param:${key}:type`,
          type: 'modified',
          oldValue: oldType,
          newValue: newType,
          breaking: true,
        });
      }
    }
  }

  return changes;
}

// ─── Confronto schema (requestBody / response) ────────────────────────────────

function diffSchema(
  oldSchema: Record<string, unknown> | undefined,
  newSchema: Record<string, unknown> | undefined,
  prefix: string
): FieldChange[] {
  const changes: FieldChange[] = [];
  const oldProps = (oldSchema?.['properties'] ?? {}) as Record<string, unknown>;
  const newProps = (newSchema?.['properties'] ?? {}) as Record<string, unknown>;
  const oldRequired = new Set((oldSchema?.['required'] as string[]) ?? []);
  const newRequired = new Set((newSchema?.['required'] as string[]) ?? []);

  for (const field of Object.keys(newProps)) {
    if (!oldProps[field]) {
      changes.push({
        field: `${prefix}.${field}`,
        type: 'added',
        newValue: newProps[field],
        breaking: false,
      });
    }
  }

  for (const field of Object.keys(oldProps)) {
    if (!newProps[field]) {
      changes.push({
        field: `${prefix}.${field}`,
        type: 'removed',
        oldValue: oldProps[field],
        breaking: oldRequired.has(field),
      });
    } else {
      const oldType = (oldProps[field] as Record<string, unknown>)?.['type'];
      const newType = (newProps[field] as Record<string, unknown>)?.['type'];
      if (oldType !== newType) {
        changes.push({
          field: `${prefix}.${field}:type`,
          type: 'modified',
          oldValue: oldType,
          newValue: newType,
          breaking: true,
        });
      }
      // required aggiunto
      if (!oldRequired.has(field) && newRequired.has(field)) {
        changes.push({
          field: `${prefix}.${field}:required`,
          type: 'modified',
          oldValue: false,
          newValue: true,
          breaking: true,
        });
      }
    }
  }

  return changes;
}

// ─── Confronto singolo endpoint ───────────────────────────────────────────────

function diffOperation(
  path: string,
  method: HttpMethod,
  oldOp: OperationObject,
  newOp: OperationObject
): FieldChange[] {
  const changes: FieldChange[] = [];

  // Parametri
  changes.push(...diffParameters(oldOp.parameters, newOp.parameters));

  // Deprecated
  if (!oldOp.deprecated && newOp.deprecated) {
    changes.push({ field: 'deprecated', type: 'modified', oldValue: false, newValue: true, breaking: false });
  }

  // RequestBody schema
  const oldBodySchema = getFirstContentSchema(oldOp.requestBody);
  const newBodySchema = getFirstContentSchema(newOp.requestBody);
  if (oldBodySchema || newBodySchema) {
    changes.push(...diffSchema(oldBodySchema, newBodySchema, 'requestBody'));
  }

  // Response 200 schema
  const oldRespSchema = getFirstContentSchema(oldOp.responses?.['200'] as ResponseObject | undefined);
  const newRespSchema = getFirstContentSchema(newOp.responses?.['200'] as ResponseObject | undefined);
  if (oldRespSchema || newRespSchema) {
    changes.push(...diffSchema(oldRespSchema, newRespSchema, 'response.200'));
  }

  return changes;
}

function getFirstContentSchema(
  obj: RequestBodyObject | ResponseObject | undefined
): Record<string, unknown> | undefined {
  if (!obj?.content) return undefined;
  const first = Object.values(obj.content)[0];
  return first?.schema as Record<string, unknown> | undefined;
}

// ─── Entry point principale ───────────────────────────────────────────────────

export function computeDiff(
  oldSpec: OpenApiSpec,
  newSpec: OpenApiSpec,
  configId: string,
  oldVersionId: string,
  newVersionId: string
): Omit<DiffReport, 'id' | 'generatedAt'> {
  const oldEndpoints = extractEndpoints(oldSpec);
  const newEndpoints = extractEndpoints(newSpec);
  const changes: EndpointChange[] = [];

  // Endpoint aggiunti
  for (const [key, { path, method }] of newEndpoints) {
    if (!oldEndpoints.has(key)) {
      changes.push({ path, method, type: 'added', breaking: false, summary: newEndpoints.get(key)?.op.summary });
    }
  }

  // Endpoint rimossi
  for (const [key, { path, method }] of oldEndpoints) {
    if (!newEndpoints.has(key)) {
      changes.push({ path, method, type: 'removed', breaking: true, summary: oldEndpoints.get(key)?.op.summary });
    }
  }

  // Endpoint modificati
  for (const [key, { path, method, op: newOp }] of newEndpoints) {
    const old = oldEndpoints.get(key);
    if (!old) continue;
    const fieldChanges = diffOperation(path, method, old.op, newOp);
    if (fieldChanges.length > 0) {
      const breaking = fieldChanges.some(c => c.breaking);
      changes.push({ path, method, type: 'modified', breaking, summary: newOp.summary, fieldChanges });
    }
  }

  // Summary
  const summary: DiffSummary = {
    endpointsAdded: changes.filter(c => c.type === 'added').length,
    endpointsRemoved: changes.filter(c => c.type === 'removed').length,
    endpointsChanged: changes.filter(c => c.type === 'modified').length,
    breakingChanges: changes.filter(c => c.breaking).length,
    fieldsAdded: changes.flatMap(c => c.fieldChanges ?? []).filter(f => f.type === 'added').length,
    fieldsRemoved: changes.flatMap(c => c.fieldChanges ?? []).filter(f => f.type === 'removed').length,
    fieldsChanged: changes.flatMap(c => c.fieldChanges ?? []).filter(f => f.type === 'modified').length,
  };

  return { configId, oldVersionId, newVersionId, summary, changes };
}
```

---

## Utilizzo nel frontend (`diff.service.ts`)

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { computeDiff } from './diff-engine';
import { DiffReport } from '../models/diff-report.model';
import { Timestamp } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class DiffService {
  constructor(private http: HttpClient) {}

  async computeFromUrls(
    oldSpecUrl: string,
    newSpecUrl: string,
    configId: string,
    oldVersionId: string,
    newVersionId: string
  ): Promise<DiffReport> {
    const [oldSpec, newSpec] = await Promise.all([
      firstValueFrom(this.http.get(oldSpecUrl)),
      firstValueFrom(this.http.get(newSpecUrl)),
    ]);

    const diff = computeDiff(oldSpec, newSpec, configId, oldVersionId, newVersionId);

    return {
      ...diff,
      generatedAt: Timestamp.now(),
    };
  }
}
```

---

## Note

- Il file `diff-engine.ts` è **identico** tra frontend e Cloud Function — copiarlo o usare un monorepo (Nx) per condividerlo.
- La logica di breaking changes attuale copre: parametri rimossi/required, tipi cambiati, endpoint rimossi. Estendibile per altri casi (security schemes, response codes, ecc.).
