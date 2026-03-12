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

  /**
   * Observable real-time di tutte le watch config nella collection.
   * @returns Observable che emette la lista aggiornata di WatchConfig
   */
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

  /**
   * Crea una nuova watch config in Firestore con timestamp server.
   * @param data - Dati della config (senza id e createdAt)
   * @param uid - UID dell'utente creatore
   */
  async create(data: Omit<WatchConfig, 'id' | 'createdAt'>, uid: string): Promise<void> {
    await addDoc(collection(this.fb.firestore, 'watchConfigs'), {
      ...data,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  }

  /**
   * Elimina una watch config da Firestore.
   * @param id - ID del documento da eliminare
   */
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.fb.firestore, `watchConfigs/${id}`));
  }
}
