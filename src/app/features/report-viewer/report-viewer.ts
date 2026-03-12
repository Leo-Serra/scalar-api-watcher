import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReportsStore, FilterType } from '../../store/reports.store';
import { ProgressStore } from '../../store/progress.store';
import { AuthStore } from '../../store/auth.store';
import { EndpointCardComponent } from './endpoint-card/endpoint-card';

interface FilterOption {
  label: string;
  value: FilterType;
}

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [RouterModule, EndpointCardComponent],
  templateUrl: './report-viewer.html',
  styleUrl: './report-viewer.scss',
})
export class ReportViewerComponent implements OnInit, OnDestroy {
  store = inject(ReportsStore);
  private progressStore = inject(ProgressStore);
  private authStore = inject(AuthStore);
  private route = inject(ActivatedRoute);

  filterOptions: FilterOption[] = [
    { label: 'Tutti', value: 'all' },
    { label: '+ Aggiunti', value: 'added' },
    { label: '- Rimossi', value: 'removed' },
    { label: '~ Modificati', value: 'modified' },
    { label: 'Breaking', value: 'breaking' },
  ];

  /** Carica il report dai query params e lo segna come visto nel progress dell'utente. */
  async ngOnInit(): Promise<void> {
    const { configId, oldVersionId, newVersionId } = this.route.snapshot.queryParams;
    await this.store.loadReport(configId, oldVersionId, newVersionId);

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
