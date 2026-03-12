# 08 — Reports Store + Report Viewer

---

## `diff-report.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { Storage, ref, getDownloadURL } from '@angular/fire/storage';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DiffReport, EndpointChange } from '../models/diff-report.model';
import { diffReportConverter } from './firestore.converters';

@Injectable({ providedIn: 'root' })
export class DiffReportService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private http = inject(HttpClient);

  async getReport(
    configId: string,
    oldVersionId: string,
    newVersionId: string
  ): Promise<DiffReport | null> {
    const col = collection(this.firestore, 'diffReports').withConverter(diffReportConverter);
    const q = query(
      col,
      where('configId', '==', configId),
      where('oldVersionId', '==', oldVersionId),
      where('newVersionId', '==', newVersionId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const report = snap.docs[0].data();
    return this.resolveChanges(report);
  }

  async getReportById(reportId: string): Promise<DiffReport | null> {
    const col = collection(this.firestore, 'diffReports').withConverter(diffReportConverter);
    const snap = await getDocs(query(col, where('__name__', '==', reportId)));
    if (snap.empty) return null;
    return this.resolveChanges(snap.docs[0].data());
  }

  private async resolveChanges(report: DiffReport): Promise<DiffReport> {
    // Caso inline: changes già in Firestore
    if (report.storageMode === 'inline' && report.changes) return report;
    // Caso ref: changes su Storage
    if (report.storageMode === 'ref' && report.changesRef) {
      const url = await getDownloadURL(ref(this.storage, report.changesRef));
      const changes = await firstValueFrom(this.http.get<EndpointChange[]>(url));
      return { ...report, changes };
    }
    return report;
  }
}
```

---

## `reports.store.ts`

```typescript
import { inject, computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods } from '@ngrx/signals';
import { DiffReportService } from '../core/services/diff-report.service';
import { DiffReport, EndpointChange } from '../core/models/diff-report.model';

type FilterType = 'all' | 'added' | 'removed' | 'modified' | 'breaking';

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
      if (f === 'breaking') return changes.filter(c => c.breaking);
      return changes.filter(c => c.type === f);
    }),

    countByFilter: computed(() => {
      const changes = report()?.changes ?? [];
      return {
        all: changes.length,
        added: changes.filter(c => c.type === 'added').length,
        removed: changes.filter(c => c.type === 'removed').length,
        modified: changes.filter(c => c.type === 'modified').length,
        breaking: changes.filter(c => c.breaking).length,
      };
    }),
  })),

  withMethods((store, svc = inject(DiffReportService)) => ({

    async loadReport(
      configId: string,
      oldVersionId: string,
      newVersionId: string
    ): Promise<void> {
      store._patchState({ loading: true, error: null, report: null });
      try {
        const report = await svc.getReport(configId, oldVersionId, newVersionId);
        store._patchState({ report, loading: false });
      } catch {
        store._patchState({ error: 'Errore caricamento report', loading: false });
      }
    },

    setFilter(filter: FilterType): void {
      store._patchState({ activeFilter: filter });
    },

    reset(): void {
      store._patchState(initialState);
    },
  }))
);
```

---

## `report-viewer.component.ts`

```typescript
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReportsStore } from '../../store/reports.store';
import { ProgressStore } from '../../store/progress.store';
import { AuthStore } from '../../store/auth.store';
import { EndpointCardComponent } from './endpoint-card/endpoint-card.component';

type FilterType = 'all' | 'added' | 'removed' | 'modified' | 'breaking';

interface FilterOption { label: string; value: FilterType; }

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [RouterModule, EndpointCardComponent],
  template: `
    <div class="min-h-screen bg-gray-50 pb-12">

      <!-- Header -->
      <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <a routerLink="/dashboard" class="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
        <h1 class="text-lg font-semibold text-gray-900">Report Diff</h1>
      </div>

      @if (store.loading()) {
        <div class="text-center py-20 text-gray-400">Caricamento report...</div>
      }

      @if (store.error()) {
        <div class="text-center py-20 text-red-400">{{ store.error() }}</div>
      }

      @if (!store.loading() && store.report()) {
        <div class="max-w-4xl mx-auto px-6 py-8">

          <!-- Summary chips -->
          @if (store.summary(); as s) {
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-bold text-green-700">{{ s.endpointsAdded }}</div>
                <div class="text-xs text-green-600 mt-1">aggiunti</div>
              </div>
              <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-bold text-red-700">{{ s.endpointsRemoved }}</div>
                <div class="text-xs text-red-600 mt-1">rimossi</div>
              </div>
              <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-bold text-yellow-700">{{ s.endpointsChanged }}</div>
                <div class="text-xs text-yellow-600 mt-1">modificati</div>
              </div>
              <div class="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <div class="text-3xl font-bold text-orange-700">{{ s.breakingChanges }}</div>
                <div class="text-xs text-orange-600 mt-1">⚡ breaking</div>
              </div>
            </div>
          }

          <!-- Filtri -->
          <div class="flex gap-2 flex-wrap mb-6">
            @for (f of filterOptions; track f.value) {
              <button
                (click)="store.setFilter(f.value)"
                class="text-sm px-4 py-1.5 rounded-full border transition"
                [class.bg-blue-600]="store.activeFilter() === f.value"
                [class.text-white]="store.activeFilter() === f.value"
                [class.border-blue-600]="store.activeFilter() === f.value"
                [class.border-gray-300]="store.activeFilter() !== f.value"
                [class.text-gray-600]="store.activeFilter() !== f.value"
              >
                {{ f.label }}
                <span class="ml-1 opacity-70">({{ store.countByFilter()[f.value] }})</span>
              </button>
            }
          </div>

          <!-- Endpoint cards -->
          <div class="space-y-3">
            @for (change of store.filteredChanges(); track change.path + change.method) {
              <app-endpoint-card [change]="change" />
            }
            @if (store.filteredChanges().length === 0) {
              <div class="text-center py-10 text-gray-400 text-sm">Nessun endpoint per questo filtro</div>
            }
          </div>

        </div>
      }

    </div>
  `,
})
export class ReportViewerComponent implements OnInit, OnDestroy {
  store = inject(ReportsStore);
  private progressStore = inject(ProgressStore);
  private authStore = inject(AuthStore);
  private route = inject(ActivatedRoute);

  filterOptions: FilterOption[] = [
    { label: 'Tutti', value: 'all' },
    { label: '+ Aggiunti', value: 'added' },
    { label: '− Rimossi', value: 'removed' },
    { label: '~ Modificati', value: 'modified' },
    { label: '⚡ Breaking', value: 'breaking' },
  ];

  async ngOnInit(): Promise<void> {
    const { configId, oldVersionId, newVersionId } = this.route.snapshot.queryParams;
    await this.store.loadReport(configId, oldVersionId, newVersionId);

    // Segna come visto
    const uid = this.authStore.uid();
    const reportId = this.store.report()?.id;
    if (uid && reportId && configId) {
      await this.progressStore.markReportViewed(uid, configId, reportId);
    }
  }

  ngOnDestroy(): void {
    this.store.reset();
  }
}
```

---

## `endpoint-card.component.ts`

```typescript
import { Component, Input, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { EndpointChange } from '../../../core/models/diff-report.model';

@Component({
  selector: 'app-endpoint-card',
  standalone: true,
  imports: [JsonPipe],
  template: `
    <div
      class="bg-white rounded-xl border overflow-hidden"
      [class.border-green-200]="change.type === 'added'"
      [class.border-red-200]="change.type === 'removed'"
      [class.border-yellow-200]="change.type === 'modified'"
    >
      <button
        class="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition"
        (click)="expanded.set(!expanded())"
      >
        <span class="text-xs font-bold px-2 py-0.5 rounded font-mono flex-shrink-0" [class]="methodClass()">
          {{ change.method }}
        </span>
        <span class="font-mono text-sm text-gray-800 flex-1 truncate">{{ change.path }}</span>
        @if (change.summary) {
          <span class="text-xs text-gray-400 hidden md:block truncate max-w-52">{{ change.summary }}</span>
        }
        <div class="flex items-center gap-2 flex-shrink-0">
          <span
            class="text-xs px-2 py-0.5 rounded-full font-medium"
            [class.bg-green-100]="change.type === 'added'"   [class.text-green-700]="change.type === 'added'"
            [class.bg-red-100]="change.type === 'removed'"   [class.text-red-700]="change.type === 'removed'"
            [class.bg-yellow-100]="change.type === 'modified'" [class.text-yellow-700]="change.type === 'modified'"
          >{{ change.type }}</span>
          @if (change.breaking) {
            <span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⚡</span>
          }
          <span class="text-gray-400">{{ expanded() ? '▲' : '▼' }}</span>
        </div>
      </button>

      @if (expanded() && change.fieldChanges?.length) {
        <div class="border-t border-gray-100 divide-y divide-gray-50">
          @for (field of change.fieldChanges!; track field.field) {
            <div class="px-5 py-3 flex items-start gap-4 text-xs">
              <span
                class="font-medium w-16 flex-shrink-0 pt-0.5"
                [class.text-green-600]="field.type === 'added'"
                [class.text-red-600]="field.type === 'removed'"
                [class.text-yellow-600]="field.type === 'modified'"
              >{{ field.type }}</span>
              <span class="font-mono text-gray-700 flex-1">{{ field.field }}</span>
              @if (field.breaking) { <span class="text-orange-500">⚡</span> }
              @if (field.oldValue !== undefined) {
                <span class="text-gray-400 font-mono">
                  {{ field.oldValue | json }} → {{ field.newValue | json }}
                </span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class EndpointCardComponent {
  @Input({ required: true }) change!: EndpointChange;
  expanded = signal(false);

  methodClass(): string {
    const map: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-700',
      POST: 'bg-green-100 text-green-700',
      PUT: 'bg-yellow-100 text-yellow-700',
      PATCH: 'bg-orange-100 text-orange-700',
      DELETE: 'bg-red-100 text-red-700',
    };
    return map[this.change.method] ?? 'bg-gray-100 text-gray-700';
  }
}
```
