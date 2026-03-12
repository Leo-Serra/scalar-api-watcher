import {
  DiffSummary,
  DiffReport,
  EndpointChange,
  FieldChange,
  HttpMethod,
} from '../models/diff-report.model';

// --- Tipi interni ---

export interface OpenApiSpec {
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

// --- HTTP methods ---

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/**
 * Type guard che verifica se una stringa è un metodo HTTP valido.
 * @param key - Stringa da verificare (case-insensitive)
 * @returns `true` se `key` è un metodo HTTP supportato
 */
function isHttpMethod(key: string): key is Lowercase<HttpMethod> {
  return HTTP_METHODS.includes(key.toUpperCase() as HttpMethod);
}

// --- Helpers ---

function endpointKey(path: string, method: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/**
 * Estrae tutti gli endpoint dalla spec OpenAPI in una mappa indicizzata per "METHOD /path".
 * @param spec - Specifica OpenAPI da analizzare
 * @returns Mappa chiave→endpoint con path, metodo HTTP e oggetto operazione
 */
function extractEndpoints(
  spec: OpenApiSpec,
): Map<string, { path: string; method: HttpMethod; op: OperationObject }> {
  const map = new Map<string, { path: string; method: HttpMethod; op: OperationObject }>();

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem as PathItem)) {
      if (!isHttpMethod(method)) continue;
      const key = endpointKey(path, method);
      map.set(key, {
        path,
        method: method.toUpperCase() as HttpMethod,
        op: operation as OperationObject,
      });
    }
  }

  return map;
}

/**
 * Confronta i parametri tra due versioni di un endpoint.
 * Breaking: parametro required rimosso, tipo cambiato, parametro reso required.
 * @param oldParams - Parametri della versione precedente
 * @param newParams - Parametri della nuova versione
 * @returns Lista di field changes rilevati tra le due versioni
 */
function diffParameters(
  oldParams: ParameterObject[] = [],
  newParams: ParameterObject[] = [],
): FieldChange[] {
  const changes: FieldChange[] = [];
  const oldMap = new Map(oldParams.map((p) => [`${p.in}:${p.name}`, p]));
  const newMap = new Map(newParams.map((p) => [`${p.in}:${p.name}`, p]));

  for (const [key, newP] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({ field: `param:${key}`, type: 'added', newValue: newP, breaking: false });
    }
  }

  for (const [key, oldP] of oldMap) {
    const newP = newMap.get(key);
    if (!newP) {
      changes.push({
        field: `param:${key}`,
        type: 'removed',
        oldValue: oldP,
        breaking: !!oldP.required,
      });
    } else {
      if (!oldP.required && newP.required) {
        changes.push({
          field: `param:${key}:required`,
          type: 'modified',
          oldValue: false,
          newValue: true,
          breaking: true,
        });
      }
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

/**
 * Confronta le properties di uno schema JSON (requestBody o response).
 * Lavora solo al primo livello di `properties` — non ricorsivo.
 * @param oldSchema - Schema JSON della versione precedente
 * @param newSchema - Schema JSON della nuova versione
 * @param prefix - Prefisso per il nome dei field (es. "requestBody", "response.200")
 * @returns Lista di field changes rilevati tra i due schemi
 */
function diffSchema(
  oldSchema: Record<string, unknown> | undefined,
  newSchema: Record<string, unknown> | undefined,
  prefix: string,
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

/**
 * Estrae lo schema dal primo content-type disponibile (tipicamente application/json).
 * @param obj - Oggetto requestBody o response da cui estrarre lo schema
 * @returns Schema JSON del primo content-type, oppure `undefined` se assente
 */
function getFirstContentSchema(
  obj: RequestBodyObject | ResponseObject | undefined,
): Record<string, unknown> | undefined {
  if (!obj?.content) return undefined;
  const first = Object.values(obj.content)[0];
  return first?.schema as Record<string, unknown> | undefined;
}

/**
 * Confronta due operazioni (stesso endpoint) e rileva tutte le differenze:
 * parametri, deprecation, requestBody e response schema.
 * @param oldOp - Operazione della versione precedente
 * @param newOp - Operazione della nuova versione
 * @returns Lista di field changes aggregati da tutti i sotto-confronti
 */
function diffOperation(oldOp: OperationObject, newOp: OperationObject): FieldChange[] {
  const changes: FieldChange[] = [];

  changes.push(...diffParameters(oldOp.parameters, newOp.parameters));

  if (!oldOp.deprecated && newOp.deprecated) {
    changes.push({
      field: 'deprecated',
      type: 'modified',
      oldValue: false,
      newValue: true,
      breaking: false,
    });
  }

  const oldBodySchema = getFirstContentSchema(oldOp.requestBody);
  const newBodySchema = getFirstContentSchema(newOp.requestBody);
  if (oldBodySchema || newBodySchema) {
    changes.push(...diffSchema(oldBodySchema, newBodySchema, 'requestBody'));
  }

  const oldRespSchema = getFirstContentSchema(
    oldOp.responses?.['200'] as ResponseObject | undefined,
  );
  const newRespSchema = getFirstContentSchema(
    newOp.responses?.['200'] as ResponseObject | undefined,
  );
  if (oldRespSchema || newRespSchema) {
    changes.push(...diffSchema(oldRespSchema, newRespSchema, 'response.200'));
  }

  return changes;
}

/**
 * Entry point del diff engine. Confronta due spec OpenAPI e produce un report
 * con le differenze per endpoint (added/removed/modified) e i field changes.
 * Funzione pura senza dipendenze Angular — usabile anche nelle Cloud Functions.
 * @param oldSpec - Specifica OpenAPI della versione precedente
 * @param newSpec - Specifica OpenAPI della nuova versione
 * @param configId - ID della watch config di riferimento
 * @param oldVersionId - ID della versione precedente
 * @param newVersionId - ID della nuova versione
 * @returns Oggetto DiffReport parziale (senza id, generatedAt, changesRef)
 */
export function computeDiff(
  oldSpec: OpenApiSpec,
  newSpec: OpenApiSpec,
  configId: string,
  oldVersionId: string,
  newVersionId: string,
): Omit<DiffReport, 'id' | 'generatedAt' | 'changesRef'> {
  const oldEndpoints = extractEndpoints(oldSpec);
  const newEndpoints = extractEndpoints(newSpec);
  const changes: EndpointChange[] = [];

  for (const [key, { path, method, op }] of newEndpoints) {
    if (!oldEndpoints.has(key)) {
      changes.push({ path, method, type: 'added', breaking: false, summary: op.summary });
    }
  }

  for (const [key, { path, method, op }] of oldEndpoints) {
    if (!newEndpoints.has(key)) {
      changes.push({ path, method, type: 'removed', breaking: true, summary: op.summary });
    }
  }

  for (const [key, { path, method, op: newOp }] of newEndpoints) {
    const old = oldEndpoints.get(key);
    if (!old) continue;
    const fieldChanges = diffOperation(old.op, newOp);
    if (fieldChanges.length > 0) {
      const breaking = fieldChanges.some((c) => c.breaking);
      changes.push({
        path,
        method,
        type: 'modified',
        breaking,
        summary: newOp.summary,
        fieldChanges,
      });
    }
  }

  const summary: DiffSummary = {
    endpointsAdded: changes.filter((c) => c.type === 'added').length,
    endpointsRemoved: changes.filter((c) => c.type === 'removed').length,
    endpointsChanged: changes.filter((c) => c.type === 'modified').length,
    breakingChanges: changes.filter((c) => c.breaking).length,
    fieldsAdded: changes.flatMap((c) => c.fieldChanges ?? []).filter((f) => f.type === 'added')
      .length,
    fieldsRemoved: changes.flatMap((c) => c.fieldChanges ?? []).filter((f) => f.type === 'removed')
      .length,
    fieldsChanged: changes.flatMap((c) => c.fieldChanges ?? []).filter((f) => f.type === 'modified')
      .length,
  };

  return { configId, oldVersionId, newVersionId, summary, changes };
}
