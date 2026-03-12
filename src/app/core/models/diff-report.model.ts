import { Timestamp } from 'firebase/firestore';

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
  changesRef: string;
  generatedAt: Timestamp;
  changes?: EndpointChange[];
}
