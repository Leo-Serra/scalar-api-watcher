import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap } from 'rxjs';
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

  withComputed((state) => {
    const versionsStore = inject(VersionsStore);

    return {
      lastSeenVersionId: computed(() => state.progress()?.lastSeenVersionId ?? null),
      viewedReports: computed(() => state.progress()?.viewedReports ?? []),
      unreadCount: computed(() => {
        const versions = versionsStore.versions();
        const lastSeen = state.progress()?.lastSeenVersionId;
        if (!lastSeen) return versions.length;
        const idx = versions.findIndex((v) => v.id === lastSeen);
        return idx === -1 ? versions.length : idx;
      }),
    };
  }),

  withMethods((store) => {
    const svc = inject(UserProgressService);

    return {
      watchProgress: rxMethod<{ uid: string; configId: string }>(
        pipe(
          switchMap(({ uid, configId }) =>
            svc.getProgress$(uid, configId).pipe(
              tapResponse({
                next: (progress) => patchState(store, { progress: progress ?? null }),
                error: () => patchState(store, { progress: null }),
              }),
            ),
          ),
        ),
      ),

      async updateLastSeen(uid: string, configId: string, versionId: string): Promise<void> {
        await svc.updateLastSeen(uid, configId, versionId);
      },

      async markReportViewed(uid: string, configId: string, reportId: string): Promise<void> {
        await svc.markReportViewed(uid, configId, reportId);
      },
    };
  }),

  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);
      const uid = authStore.uid();
      if (uid) {
        store.watchProgress({ uid, configId: 'default' });
      }
    },
  }),
);
