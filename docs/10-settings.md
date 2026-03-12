# 10 — Settings: Watch Config Store + UI

---

## `watch-config.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { WatchConfig } from '../models/watch-config.model';
import { watchConfigConverter } from './firestore.converters';

@Injectable({ providedIn: 'root' })
export class WatchConfigService {
  private firestore = inject(Firestore);

  getConfigs$(): Observable<WatchConfig[]> {
    const col = collection(this.firestore, 'watchConfigs').withConverter(watchConfigConverter);
    return collectionData(col, { idField: 'id' });
  }

  async create(data: Omit<WatchConfig, 'id' | 'createdAt'>, uid: string): Promise<void> {
    await addDoc(collection(this.firestore, 'watchConfigs'), {
      ...data,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `watchConfigs/${id}`));
  }
}
```

---

## `watch-config.store.ts`

```typescript
import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withHooks } from '@ngrx/signals';
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

  withMethods((store, svc = inject(WatchConfigService), authStore = inject(AuthStore)) => ({

    loadConfigs: rxMethod<void>(
      pipe(
        switchMap(() => {
          store._patchState({ loading: true });
          return svc.getConfigs$().pipe(
            tapResponse({
              next: configs => store._patchState({ configs, loading: false }),
              error: () => store._patchState({ error: 'Errore caricamento configs', loading: false }),
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
      store._patchState({ saving: true, error: null });
      try {
        await svc.create({ specUrl, cronSchedule, maxHistory, extraHeaders, createdBy: uid }, uid);
      } catch {
        store._patchState({ error: 'Errore nel salvataggio' });
      } finally {
        store._patchState({ saving: false });
      }
    },

    async removeConfig(id: string): Promise<void> {
      await svc.delete(id);
    },
  })),

  withHooks({
    onInit(store) {
      store.loadConfigs();
    },
  })
);
```

---

## `watch-config.component.ts`

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { WatchConfigStore } from '../../store/watch-config.store';

interface HeaderEntry { key: string; value: string; }

@Component({
  selector: 'app-watch-config',
  standalone: true,
  imports: [FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50 pb-12">

      <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <a routerLink="/dashboard" class="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
        <h1 class="text-lg font-semibold text-gray-900">Impostazioni Watch</h1>
      </div>

      <div class="max-w-2xl mx-auto px-6 py-8 space-y-6">

        <!-- Config esistenti -->
        @for (config of store.configs(); track config.id) {
          <div class="bg-white rounded-xl border border-gray-200 p-6">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <p class="font-mono text-sm text-gray-800 truncate">{{ config.specUrl }}</p>
                <div class="flex gap-4 mt-2 text-xs text-gray-400">
                  <span>Schedule: <code class="font-mono">{{ config.cronSchedule }}</code></span>
                  <span>Max history: {{ config.maxHistory }}</span>
                </div>
                @if (config.extraHeaders && hasKeys(config.extraHeaders)) {
                  <div class="mt-3 space-y-1">
                    @for (key of objectKeys(config.extraHeaders); track key) {
                      <div class="text-xs font-mono text-gray-400">
                        {{ key }}: <span class="text-gray-600">{{ config.extraHeaders[key] }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
              <button
                (click)="removeConfig(config)"
                class="ml-4 text-sm text-red-400 hover:text-red-600 flex-shrink-0"
              >
                Elimina
              </button>
            </div>
          </div>
        }

        @if (!store.loading() && store.configs().length === 0) {
          <p class="text-sm text-gray-400 text-center py-4">Nessuna API configurata</p>
        }

        <!-- Form nuova config -->
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h2 class="font-semibold text-gray-900 mb-6">Aggiungi API da monitorare</h2>

          <div class="space-y-4">

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">URL Spec OpenAPI *</label>
              <input
                type="url"
                [(ngModel)]="specUrl"
                placeholder="https://api.example.com/openapi.json"
                class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Cron schedule</label>
                <input
                  type="text"
                  [(ngModel)]="cronSchedule"
                  class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Max history</label>
                <input
                  type="number"
                  [(ngModel)]="maxHistory"
                  min="5" max="200"
                  class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <!-- Headers -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Headers HTTP custom</label>
              @for (h of headers(); track $index; let i = $index) {
                <div class="flex gap-2 mb-2">
                  <input
                    type="text"
                    [(ngModel)]="h.key"
                    placeholder="Authorization"
                    class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    [(ngModel)]="h.value"
                    placeholder="Bearer ..."
                    class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button (click)="removeHeader(i)" class="text-red-400 hover:text-red-600 px-2">✕</button>
                </div>
              }
              <button (click)="addHeader()" class="text-sm text-blue-600 hover:text-blue-800">
                + Aggiungi header
              </button>
            </div>

            @if (store.error()) {
              <p class="text-sm text-red-500">{{ store.error() }}</p>
            }

            <button
              (click)="save()"
              [disabled]="store.saving()"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 text-sm transition disabled:opacity-50"
            >
              {{ store.saving() ? 'Salvataggio...' : 'Salva configurazione' }}
            </button>

          </div>
        </div>
      </div>
    </div>
  `,
})
export class WatchConfigComponent {
  store = inject(WatchConfigStore);

  specUrl = '';
  cronSchedule = '0 * * * *';
  maxHistory = 50;
  headers = signal<HeaderEntry[]>([]);

  objectKeys = Object.keys;
  hasKeys = (obj: Record<string, string>) => Object.keys(obj).length > 0;

  addHeader() { this.headers.update(h => [...h, { key: '', value: '' }]); }
  removeHeader(i: number) { this.headers.update(h => h.filter((_, idx) => idx !== i)); }

  async save(): Promise<void> {
    if (!this.specUrl.trim()) return;
    const extraHeaders = this.headers().reduce<Record<string, string>>((acc, h) => {
      if (h.key.trim()) acc[h.key.trim()] = h.value.trim();
      return acc;
    }, {});
    await this.store.addConfig(this.specUrl, this.cronSchedule, this.maxHistory, extraHeaders);
    this.specUrl = '';
    this.headers.set([]);
  }

  async removeConfig(config: { id?: string; specUrl: string }): Promise<void> {
    if (!config.id || !confirm(`Eliminare la config per ${config.specUrl}?`)) return;
    await this.store.removeConfig(config.id);
  }
}
```
