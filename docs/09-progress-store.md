# 09 — Progress Store (Tracking Lettura + Bookmark)

---

## `user-progress.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  getDoc,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { ReadProgress } from '../models/user-progress.model';

@Injectable({ providedIn: 'root' })
export class UserProgressService {
  private firestore = inject(Firestore);

  getProgress$(uid: string, configId: string): Observable<ReadProgress | undefined> {
    const ref = doc(this.firestore, `users/${uid}/readProgress/${configId}`);
    return docData(ref) as Observable<ReadProgress | undefined>;
  }

  async updateLastSeen(uid: string, configId: string, versionId: string): Promise<void> {
    const ref = doc(this.firestore, `users/${uid}/readProgress/${configId}`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { lastSeenVersionId: versionId, lastSeenAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        configId,
        lastSeenVersionId: versionId,
        lastSeenAt: serverTimestamp(),
        viewedReports: [],
      });
    }
  }

  async markReportViewed(uid: string, configId: string, reportId: string): Promise<void> {
    const ref = doc(this.firestore, `users/${uid}/readProgress/${configId}`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { viewedReports: arrayUnion(reportId) });
    } else {
      await setDoc(ref, {
        configId,
        lastSeenVersionId: null,
        lastSeenAt: serverTimestamp(),
        viewedReports: [reportId],
      });
    }
  }
}
```

---

## `progress.store.ts`

```typescript
import { inject, computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, combineLatest, EMPTY } from 'rxjs';
import { UserProgressService } from '../core/services/user-progress.service';
import { AuthStore } from './auth.store';
import { VersionsStore } from './versions.store';
import { ReadProgress } from '../core/models/user-progress.model';

interface ProgressState {
  progress: ReadProgress | null;
  loading: boolean;
}

export const ProgressStore = signalStore(
  { providedIn: 'root' },

  withState<ProgressState>({
    progress: null,
    loading: false,
  }),

  withComputed(({ progress }, versionsStore = inject(VersionsStore)) => ({
    lastSeenVersionId: computed(() => progress()?.lastSeenVersionId ?? null),
    viewedReports: computed(() => progress()?.viewedReports ?? []),

    // Quante versioni sono più recenti di lastSeen → quelle non ancora viste
    unreadCount: computed(() => {
      const versions = versionsStore.versions();
      const lastSeen = progress()?.lastSeenVersionId;
      if (!lastSeen) return versions.length;
      const idx = versions.findIndex(v => v.id === lastSeen);
      return idx === -1 ? versions.length : idx;
    }),
  })),

  withMethods((store, svc = inject(UserProgressService), authStore = inject(AuthStore)) => ({

    // rxMethod: aggiorna il progress ogni volta che cambia uid o configId
    watchProgress: rxMethod<{ uid: string; configId: string }>(
      pipe(
        switchMap(({ uid, configId }) =>
          svc.getProgress$(uid, configId).pipe(
            tapResponse({
              next: progress => store._patchState({ progress: progress ?? null }),
              error: () => store._patchState({ progress: null }),
            })
          )
        )
      )
    ),

    async updateLastSeen(uid: string, configId: string, versionId: string): Promise<void> {
      await svc.updateLastSeen(uid, configId, versionId);
      // Il listener rxMethod aggiornerà lo stato automaticamente
    },

    async markReportViewed(uid: string, configId: string, reportId: string): Promise<void> {
      await svc.markReportViewed(uid, configId, reportId);
    },
  })),

  withHooks({
    onInit(store, authStore = inject(AuthStore)) {
      // Avvia il listener solo quando l'utente è loggato
      // In un'implementazione reale si usa toObservable(authStore.uid)
      // per reagire ai cambiamenti di autenticazione
      const uid = authStore.uid();
      if (uid) {
        store.watchProgress({ uid, configId: 'default' });
      }
    },
  })
);
```

---

## `relative-time.pipe.ts`

```typescript
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'relativeTime', standalone: true })
export class RelativeTimePipe implements PipeTransform {
  transform(value: Date | null | undefined): string {
    if (!value) return '—';
    const diff = Date.now() - value.getTime();
    const m = Math.floor(diff / 60_000);
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (m < 1) return 'adesso';
    if (m < 60) return `${m}m fa`;
    if (h < 24) return `${h}h fa`;
    if (d === 1) return 'ieri';
    if (d < 30) return `${d}g fa`;
    return value.toLocaleDateString('it-IT');
  }
}
```
