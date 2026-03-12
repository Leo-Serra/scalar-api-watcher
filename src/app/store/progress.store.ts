import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
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

  withComputed(({ progress }) => ({
    lastSeenVersionId: computed(() => progress()?.lastSeenVersionId ?? null),
    viewedReports: computed(() => progress()?.viewedReports ?? []),
    unreadCount: computed(() => 0), // Will be fully implemented in Phase 8
  })),

  withMethods((store) => ({
    async updateLastSeen(_uid: string, _configId: string, _versionId: string): Promise<void> {
      // Will be fully implemented in Phase 8
    },

    async markReportViewed(_uid: string, _configId: string, _reportId: string): Promise<void> {
      // Will be fully implemented in Phase 8
    },
  }))
);
