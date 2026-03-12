import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { firstValueFrom } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { DiffReport, EndpointChange } from '../models/diff-report.model';
import { diffReportConverter } from './firestore.converters';

@Injectable({ providedIn: 'root' })
export class DiffReportService {
  private fb = inject(FirebaseService);
  private http = inject(HttpClient);

  async getReport(
    configId: string,
    oldVersionId: string,
    newVersionId: string,
  ): Promise<DiffReport | null> {
    const col = collection(this.fb.firestore, 'diffReports').withConverter(diffReportConverter);
    const q = query(
      col,
      where('configId', '==', configId),
      where('oldVersionId', '==', oldVersionId),
      where('newVersionId', '==', newVersionId),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const report = snap.docs[0].data();
    return this.resolveChanges(report);
  }

  async getReportById(reportId: string): Promise<DiffReport | null> {
    const docRef = doc(this.fb.firestore, 'diffReports', reportId).withConverter(
      diffReportConverter,
    );
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return this.resolveChanges(snap.data());
  }

  private async resolveChanges(report: DiffReport): Promise<DiffReport> {
    if (report.changes) return report;
    if (report.changesRef) {
      const url = await getDownloadURL(ref(this.fb.storage, report.changesRef));
      const changes = await firstValueFrom(this.http.get<EndpointChange[]>(url));
      return { ...report, changes };
    }
    return report;
  }
}
