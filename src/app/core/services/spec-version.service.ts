import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { Observable, firstValueFrom } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { SpecVersion } from '../models/spec-version.model';
import { specVersionConverter } from './firestore.converters';

@Injectable({ providedIn: 'root' })
export class SpecVersionService {
  private fb = inject(FirebaseService);
  private http = inject(HttpClient);

  /**
   * Observable real-time delle versioni per una config, ordinate desc per timestamp.
   * @param configId - ID della watch config
   * @returns Observable che emette la lista aggiornata di SpecVersion
   */
  getVersions$(configId: string): Observable<SpecVersion[]> {
    return new Observable<SpecVersion[]>((subscriber) => {
      const col = collection(this.fb.firestore, 'specVersions').withConverter(specVersionConverter);
      const q = query(col, where('configId', '==', configId), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const versions = snapshot.docs.map((doc) => doc.data());
          subscriber.next(versions);
        },
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  /**
   * Scarica il JSON completo della spec OpenAPI dal path `specRef` in Cloud Storage.
   * @param version - La SpecVersion il cui `specRef` punta al file in Storage
   * @returns Oggetto JSON della specifica OpenAPI
   */
  async resolveSpecJson(version: SpecVersion): Promise<Record<string, unknown>> {
    const url = await getDownloadURL(ref(this.fb.storage, version.specRef));
    return firstValueFrom(this.http.get<Record<string, unknown>>(url));
  }
}
