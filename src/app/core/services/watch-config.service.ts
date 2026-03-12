import { Injectable, inject } from '@angular/core';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { WatchConfig } from '../models/watch-config.model';
import { watchConfigConverter } from './firestore.converters';

@Injectable({ providedIn: 'root' })
export class WatchConfigService {
  private fb = inject(FirebaseService);

  getConfigs$(): Observable<WatchConfig[]> {
    return new Observable<WatchConfig[]>((subscriber) => {
      const col = collection(this.fb.firestore, 'watchConfigs').withConverter(watchConfigConverter);
      const unsubscribe = onSnapshot(
        col,
        (snapshot) => {
          const configs = snapshot.docs.map((d) => d.data());
          subscriber.next(configs);
        },
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  async create(data: Omit<WatchConfig, 'id' | 'createdAt'>, uid: string): Promise<void> {
    await addDoc(collection(this.fb.firestore, 'watchConfigs'), {
      ...data,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.fb.firestore, `watchConfigs/${id}`));
  }
}
