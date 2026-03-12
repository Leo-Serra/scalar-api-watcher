import { inject, computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { DiffReportService } from '../core/services/diff-report.service';
import { DiffReport, EndpointChange } from '../core/models/diff-report.model';

/** Filtro attivo nella vista report: 'breaking' è trasversale (non è un ChangeType). */
export type FilterType = 'all' | 'added' | 'removed' | 'modified' | 'breaking';

interface ReportsState {
  report: DiffReport | null;
  loading: boolean;
  error: string | null;
  activeFilter: FilterType;
}

const initialState: ReportsState = {
  report: null,
  loading: false,
  error: null,
  activeFilter: 'all',
};

export const ReportsStore = signalStore(
  { providedIn: 'root' },

  withState<ReportsState>(initialState),

  withComputed(({ report, activeFilter }) => ({
    summary: computed(() => report()?.summary ?? null),

    filteredChanges: computed((): EndpointChange[] => {
      const changes = report()?.changes ?? [];
      const f = activeFilter();
      if (f === 'all') return changes;
      if (f === 'breaking') return changes.filter((c) => c.breaking);
      return changes.filter((c) => c.type === f);
    }),

    countByFilter: computed(() => {
      const changes = report()?.changes ?? [];
      return {
        all: changes.length,
        added: changes.filter((c) => c.type === 'added').length,
        removed: changes.filter((c) => c.type === 'removed').length,
        modified: changes.filter((c) => c.type === 'modified').length,
        breaking: changes.filter((c) => c.breaking).length,
      };
    }),
  })),

  withMethods((store) => {
    const svc = inject(DiffReportService);

    return {
      /**
       * Carica un report dal trio (configId, oldVersionId, newVersionId).
       * Il service risolve anche `changesRef` scaricando i dettagli da Storage.
       * @param configId - ID della watch config
       * @param oldVersionId - ID della versione precedente
       * @param newVersionId - ID della nuova versione
       */
      async loadReport(
        configId: string,
        oldVersionId: string,
        newVersionId: string,
      ): Promise<void> {
        patchState(store, { loading: true, error: null, report: null });
        try {
          const report = await svc.getReport(configId, oldVersionId, newVersionId);
          patchState(store, { report, loading: false });
        } catch {
          patchState(store, { error: 'Errore caricamento report', loading: false });
        }
      },

      /**
       * Imposta il filtro attivo per la vista report.
       * @param filter - Tipo di filtro da applicare
       */
      setFilter(filter: FilterType): void {
        patchState(store, { activeFilter: filter });
      },

      reset(): void {
        patchState(store, initialState);
      },
    };
  }),
);
