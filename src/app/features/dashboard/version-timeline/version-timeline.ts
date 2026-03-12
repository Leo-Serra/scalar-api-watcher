import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SpecVersion } from '../../../core/models/spec-version.model';

@Component({
  selector: 'app-version-timeline',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './version-timeline.html',
  styleUrl: './version-timeline.scss',
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
    const lastIdx = this.versions.findIndex((v) => v.id === this.lastSeenVersionId);
    const myIdx = this.versions.findIndex((v) => v.id === version.id);
    return lastIdx !== -1 && myIdx < lastIdx;
  }

  isLastSeen(version: SpecVersion): boolean {
    return version.id === this.lastSeenVersionId;
  }
}
