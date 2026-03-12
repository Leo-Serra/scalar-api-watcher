# 07 — Versions Store + Dashboard

---

## `spec-version.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  collectionData,
} from '@angular/fire/firestore';
import { Storage, ref, getDownloadURL } from '@angular/fire/storage';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { SpecVersion } from '../models/spec-version.model';
import { specVersionConverter } from './firestore.converters';

@Injectable({ providedIn: 'root' })
export class SpecVersionService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private http = inject(HttpClient);

  getVersions$(configId: string): Observable<SpecVersion[]> {
    const col = collection(this.firestore, 'specVersions').withConverter(specVersionConverter);
    const q = query(col, where('configId', '==', configId), orderBy('timestamp', 'desc'));
    return collectionData(q, { idField: 'id' });
  }

  async resolveSpecJson(version: SpecVersion): Promise<Record<string, unknown>> {
    const url = await getDownloadURL(ref(this.storage, version.specRef));
    return firstValueFrom(this.http.get<Record<string, unknown>>(url));
  }
}
```

---

## `versions.store.ts`

```typescript
import { inject, computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
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

  withMethods((store, svc = inject(SpecVersionService)) => ({

    loadVersions: rxMethod<string>(
      pipe(
        switchMap(configId => {
          store._patchState({ loadingVersions: true, activeConfigId: configId });
          return svc.getVersions$(configId).pipe(
            tapResponse({
              next: versions => store._patchState({ versions, loadingVersions: false }),
              error: () => store._patchState({ error: 'Errore caricamento versioni', loadingVersions: false }),
            })
          );
        })
      )
    ),

    async openSpecPreview(version: SpecVersion): Promise<void> {
      store._patchState({ previewVersion: version, previewJson: null, previewLoading: true });
      try {
        const json = await svc.resolveSpecJson(version);
        store._patchState({ previewJson: json, previewLoading: false });
      } catch {
        store._patchState({ error: 'Errore caricamento spec', previewLoading: false });
      }
    },

    closeSpecPreview(): void {
      store._patchState({ previewVersion: null, previewJson: null });
    },

    setActiveConfig(configId: string): void {
      store.loadVersions(configId);
    },
  })),

  withHooks({
    onInit(store) {
      store.loadVersions('default');
    },
  })
);
```

---

## `dashboard.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule, JsonPipe, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../store/auth.store';
import { VersionsStore } from '../../store/versions.store';
import { ProgressStore } from '../../store/progress.store';
import { VersionTimelineComponent } from './version-timeline/version-timeline.component';
import { SpecVersion } from '../../core/models/spec-version.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, JsonPipe, DatePipe, VersionTimelineComponent],
  template: `
    <div class="min-h-screen bg-gray-50">

      <nav class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span class="font-semibold text-gray-900">API Watcher</span>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-500">{{ authStore.email() }}</span>
          <button (click)="authStore.logout()" class="text-sm text-gray-500 hover:text-red-600 transition">
            Esci
          </button>
        </div>
      </nav>

      <div class="max-w-4xl mx-auto px-6 py-8">

        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Timeline versioni</h1>
            <p class="text-gray-500 text-sm mt-1">
              {{ progressStore.unreadCount() }} versioni non viste
            </p>
          </div>
          <a routerLink="/settings" class="text-sm text-blue-600 border border-blue-200 rounded-lg px-4 py-2">
            ⚙ Impostazioni
          </a>
        </div>

        @if (versionsStore.loadingVersions()) {
          <div class="text-center py-20 text-gray-400">Caricamento versioni...</div>
        }

        @if (!versionsStore.loadingVersions() && versionsStore.hasVersions()) {
          <app-version-timeline
            [versions]="versionsStore.versions()"
            [lastSeenVersionId]="progressStore.lastSeenVersionId()"
            [viewedReports]="progressStore.viewedReports()"
            (viewSpec)="versionsStore.openSpecPreview($event)"
            (viewDiff)="onViewDiff($event)"
            (markAsRead)="onMarkAsRead($event)"
          />
        }

        @if (!versionsStore.loadingVersions() && !versionsStore.hasVersions()) {
          <div class="text-center py-20 text-gray-400">
            Nessuna versione rilevata ancora.
          </div>
        }

      </div>

      <!-- Modal spec JSON -->
      @if (versionsStore.previewVersion()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          (click)="versionsStore.closeSpecPreview()"
        >
          <div
            class="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-center justify-between px-6 py-4 border-b">
              <h2 class="font-semibold text-gray-900">
                {{ versionsStore.previewVersion()!.title }}
                <span class="text-gray-400 font-normal ml-2">v{{ versionsStore.previewVersion()!.version }}</span>
              </h2>
              <button (click)="versionsStore.closeSpecPreview()" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div class="overflow-auto flex-1 p-4 bg-gray-50 rounded-b-2xl">
              @if (versionsStore.previewLoading()) {
                <div class="text-center py-10 text-gray-400">Caricamento spec...</div>
              } @else {
                <pre class="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{{ versionsStore.previewJson() | json }}</pre>
              }
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class DashboardComponent {
  authStore = inject(AuthStore);
  versionsStore = inject(VersionsStore);
  progressStore = inject(ProgressStore);
  private router = inject(Router);

  onViewDiff(version: SpecVersion): void {
    const versions = this.versionsStore.versions();
    const idx = versions.findIndex(v => v.id === version.id);
    if (idx < versions.length - 1) {
      const oldVersion = versions[idx + 1];
      this.router.navigate(['/report', 'new'], {
        queryParams: {
          configId: version.configId,
          oldVersionId: oldVersion.id,
          newVersionId: version.id,
        },
      });
    }
  }

  async onMarkAsRead(version: SpecVersion): Promise<void> {
    const uid = this.authStore.uid();
    if (!uid || !version.id) return;
    await this.progressStore.updateLastSeen(uid, version.configId, version.id);
  }
}
```

---

## `version-timeline.component.ts`

```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SpecVersion } from '../../../core/models/spec-version.model';

@Component({
  selector: 'app-version-timeline',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="space-y-3">
      @for (version of versions; track version.id; let i = $index) {
        <div
          class="bg-white rounded-xl border px-6 py-4 flex items-start gap-4 transition-shadow hover:shadow-sm"
          [class.border-orange-200]="isNew(version)"
          [class.border-blue-300]="isLastSeen(version)"
          [class.border-gray-200]="!isNew(version) && !isLastSeen(version)"
        >
          <div class="mt-1.5 flex-shrink-0">
            @if (isLastSeen(version)) {
              <div class="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-100"></div>
            } @else if (isNew(version)) {
              <div class="w-3 h-3 rounded-full bg-orange-400"></div>
            } @else {
              <div class="w-3 h-3 rounded-full bg-gray-200"></div>
            }
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-gray-900 text-sm">{{ version.title }}</span>
              <span class="text-xs text-gray-400">v{{ version.version }}</span>
              @if (isNew(version)) {
                <span class="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">NEW</span>
              }
              @if (isLastSeen(version)) {
                <span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">← sei qui</span>
              }
            </div>
            <div class="text-xs text-gray-400 mt-1 flex gap-4 flex-wrap">
              <span>{{ version.timestamp?.toDate() | date:'dd MMM yyyy, HH:mm' }}</span>
              <span>{{ version.endpointCount }} endpoint</span>
              <span class="font-mono">{{ version.hash }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              (click)="viewSpec.emit(version)"
              class="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-1.5 transition"
            >
              Spec
            </button>
            @if (i < versions.length - 1) {
              <button
                (click)="viewDiff.emit(version)"
                class="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-3 py-1.5 transition"
              >
                Diff ↕
              </button>
            }
            @if (isNew(version)) {
              <button
                (click)="markAsRead.emit(version)"
                class="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 transition"
              >
                Segna qui ✓
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class VersionTimelineComponent {
  @Input() versions: SpecVersion[] = [];
  @Input() lastSeenVersionId: string | null = null;
  @Input() viewedReports: string[] = [];

  @Output() viewSpec = new EventEmitter<SpecVersion>();
  @Output() viewDiff = new EventEmitter<SpecVersion>();
  @Output() markAsRead = new EventEmitter<SpecVersion>();

  isNew(version: SpecVersion): boolean {
    if (!this.lastSeenVersionId) return true;
    const lastIdx = this.versions.findIndex(v => v.id === this.lastSeenVersionId);
    const myIdx = this.versions.findIndex(v => v.id === version.id);
    return lastIdx !== -1 && myIdx < lastIdx;
  }

  isLastSeen(version: SpecVersion): boolean {
    return version.id === this.lastSeenVersionId;
  }
}
```
