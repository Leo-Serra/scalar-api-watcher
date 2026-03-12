import { inject, computed } from '@angular/core';
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
import { SpecVersionService } from '../core/services/spec-version.service';
import { SpecVersion } from '../core/models/spec-version.model';

interface VersionsState {
  versions: SpecVersion[];
  activeConfigId: string;
  loadingVersions: boolean;
  previewVersion: SpecVersion | null;
  previewJson: Record<string, unknown> | null;
  previewLoading: boolean;
  error: string | null;
}

export const VersionsStore = signalStore(
  { providedIn: 'root' },

  withState<VersionsState>({
    versions: [],
    activeConfigId: 'default',
    loadingVersions: false,
    previewVersion: null,
    previewJson: null,
    previewLoading: false,
    error: null,
  }),

  withComputed(({ versions }) => ({
    hasVersions: computed(() => versions().length > 0),
    latestVersion: computed(() => versions()[0] ?? null),
  })),

  withMethods((store) => {
    const svc = inject(SpecVersionService);

    return {
      loadVersions: rxMethod<string>(
        pipe(
          switchMap((configId) => {
            patchState(store, { loadingVersions: true, activeConfigId: configId });
            return svc.getVersions$(configId).pipe(
              tapResponse({
                next: (versions) => patchState(store, { versions, loadingVersions: false }),
                error: () =>
                  patchState(store, {
                    error: 'Errore caricamento versioni',
                    loadingVersions: false,
                  }),
              }),
            );
          }),
        ),
      ),

      async openSpecPreview(version: SpecVersion): Promise<void> {
        patchState(store, { previewVersion: version, previewJson: null, previewLoading: true });
        try {
          const json = await svc.resolveSpecJson(version);
          patchState(store, { previewJson: json, previewLoading: false });
        } catch {
          patchState(store, { error: 'Errore caricamento spec', previewLoading: false });
        }
      },

      closeSpecPreview(): void {
        patchState(store, { previewVersion: null, previewJson: null });
      },

      setActiveConfig(configId: string): void {
        this.loadVersions(configId);
      },
    };
  }),

  withHooks({
    onInit(store) {
      store.loadVersions('default');
    },
  }),
);
