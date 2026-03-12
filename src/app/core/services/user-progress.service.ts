import { Injectable, inject } from '@angular/core';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { ReadProgress } from '../models/user-progress.model';

@Injectable({ providedIn: 'root' })
export class UserProgressService {
  private fb = inject(FirebaseService);

  /**
   * Observable real-time sul documento di progresso lettura dell'utente per una config.
   * @param uid - UID dell'utente Firebase
   * @param configId - ID della watch config
   * @returns Observable che emette il ReadProgress aggiornato o `undefined` se non esiste
   */
  getProgress$(uid: string, configId: string): Observable<ReadProgress | undefined> {
    return new Observable<ReadProgress | undefined>((subscriber) => {
      const docRef = doc(this.fb.firestore, `users/${uid}/readProgress/${configId}`);
      const unsubscribe = onSnapshot(
        docRef,
        (snap) => {
          subscriber.next(snap.exists() ? (snap.data() as ReadProgress) : undefined);
        },
        (error) => subscriber.error(error),
      );
      return () => unsubscribe();
    });
  }

  /**
   * Aggiorna il bookmark "sei qui" dell'utente; crea il doc se non esiste.
   * @param uid - UID dell'utente Firebase
   * @param configId - ID della watch config
   * @param versionId - ID della versione da segnare come ultima vista
   */
  async updateLastSeen(uid: string, configId: string, versionId: string): Promise<void> {
    const docRef = doc(this.fb.firestore, `users/${uid}/readProgress/${configId}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, { lastSeenVersionId: versionId, lastSeenAt: serverTimestamp() });
    } else {
      await setDoc(docRef, {
        configId,
        lastSeenVersionId: versionId,
        lastSeenAt: serverTimestamp(),
        viewedReports: [],
      });
    }
  }

  /**
   * Aggiunge il reportId alla lista dei report visti (usa `arrayUnion` per idempotenza).
   * @param uid - UID dell'utente Firebase
   * @param configId - ID della watch config
   * @param reportId - ID del report da segnare come visto
   */
  async markReportViewed(uid: string, configId: string, reportId: string): Promise<void> {
    const docRef = doc(this.fb.firestore, `users/${uid}/readProgress/${configId}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, { viewedReports: arrayUnion(reportId) });
    } else {
      await setDoc(docRef, {
        configId,
        lastSeenVersionId: null,
        lastSeenAt: serverTimestamp(),
        viewedReports: [reportId],
      });
    }
  }
}
