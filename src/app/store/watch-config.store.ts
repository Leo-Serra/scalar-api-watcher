import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap } from 'rxjs';
import { WatchConfigService } from '../core/services/watch-config.service';
import { AuthStore } from './auth.store';
import { WatchConfig } from '../core/models/watch-config.model';

interface WatchConfigState {
  configs: WatchConfig[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export const WatchConfigStore = signalStore(
  { providedIn: 'root' },

  withState<WatchConfigState>({
    configs: [],
    loading: false,
    saving: false,
    error: null,
  }),

  withMethods((store) => {
    const svc = inject(WatchConfigService);
    const authStore = inject(AuthStore);

    return {
      loadConfigs: rxMethod<void>(
        pipe(
          switchMap(() => {
            patchState(store, { loading: true });
            return svc.getConfigs$().pipe(
              tapResponse({
                next: (configs) => patchState(store, { configs, loading: false }),
                error: () =>
                  patchState(store, { error: 'Errore caricamento configs', loading: false }),
              })
            );
          })
        )
      ),

      async addConfig(
        specUrl: string,
        cronSchedule: string,
        maxHistory: number,
        extraHeaders: Record<string, string>
      ): Promise<void> {
        const uid = authStore.uid();
        if (!uid) return;
        patchState(store, { saving: true, error: null });
        try {
          await svc.create({ specUrl, cronSchedule, maxHistory, extraHeaders, createdBy: uid }, uid);
        } catch {
          patchState(store, { error: 'Errore nel salvataggio' });
        } finally {
          patchState(store, { saving: false });
        }
      },

      async removeConfig(id: string): Promise<void> {
        await svc.delete(id);
      },
    };
  }),

  withHooks({
    onInit(store) {
      store.loadConfigs();
    },
  })
);
