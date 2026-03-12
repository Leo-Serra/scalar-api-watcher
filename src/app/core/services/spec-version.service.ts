import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { Observable, firstValueFrom } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { SpecVersion } from '../models/spec-version.model';
import { specVersionConverter } from './firestore.converters';

@Injectable({ providedIn: 'root' })
export class SpecVersionService {
  private fb = inject(FirebaseService);
  private http = inject(HttpClient);

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
        (error) => subscriber.error(error)
      );
      return () => unsubscribe();
    });
  }

  async resolveSpecJson(version: SpecVersion): Promise<Record<string, unknown>> {
    const url = await getDownloadURL(ref(this.fb.storage, version.specRef));
    return firstValueFrom(this.http.get<Record<string, unknown>>(url));
  }
}
