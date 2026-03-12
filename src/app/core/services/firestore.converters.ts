import {
  FirestoreDataConverter,
  DocumentData,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import { WatchConfig } from '../models/watch-config.model';
import { SpecVersion } from '../models/spec-version.model';
import { DiffReport } from '../models/diff-report.model';

/**
 * Factory per converter Firestore che inietta automaticamente `doc.id` nel campo `id`
 * in lettura, e lo rimuove in scrittura per evitare duplicazione.
 * @typeParam T - Tipo del documento, deve avere un campo `id` opzionale
 * @returns Un `FirestoreDataConverter<T>` che gestisce la serializzazione/deserializzazione
 */
function makeConverter<T extends { id?: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore({ id, ...data }: T): DocumentData {
      return data as DocumentData;
    },
    fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): T {
      return { id: snap.id, ...snap.data(options) } as T;
    },
  };
}

export const watchConfigConverter = makeConverter<WatchConfig>();
export const specVersionConverter = makeConverter<SpecVersion>();
export const diffReportConverter = makeConverter<DiffReport>();
