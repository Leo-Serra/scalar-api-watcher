import { Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../store/auth.store';
import { VersionsStore } from '../../store/versions.store';
import { ProgressStore } from '../../store/progress.store';
import { VersionTimelineComponent } from './version-timeline/version-timeline';
import { SpecVersion } from '../../core/models/spec-version.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, JsonPipe, VersionTimelineComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  authStore = inject(AuthStore);
  versionsStore = inject(VersionsStore);
  progressStore = inject(ProgressStore);
  private router = inject(Router);

  onViewDiff(version: SpecVersion): void {
    const versions = this.versionsStore.versions();
    const idx = versions.findIndex((v) => v.id === version.id);
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
