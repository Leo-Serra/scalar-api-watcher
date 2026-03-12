import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { WatchConfigStore } from '../../store/watch-config.store';

interface HeaderEntry {
  key: string;
  value: string;
}

@Component({
  selector: 'app-watch-config',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './watch-config.html',
  styleUrl: './watch-config.scss',
})
export class WatchConfigComponent {
  store = inject(WatchConfigStore);

  specUrl = '';
  cronSchedule = '0 * * * *';
  maxHistory = 50;
  headers = signal<HeaderEntry[]>([]);

  objectKeys = Object.keys;
  hasKeys = (obj: Record<string, string>) => Object.keys(obj).length > 0;

  addHeader() {
    this.headers.update((h) => [...h, { key: '', value: '' }]);
  }

  removeHeader(i: number) {
    this.headers.update((h) => h.filter((_, idx) => idx !== i));
  }

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
