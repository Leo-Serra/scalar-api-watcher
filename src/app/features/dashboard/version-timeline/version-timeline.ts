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

  /**
   * Una versione è "nuova" se si trova prima (indice minore) di lastSeen nella lista desc.
   * Se lastSeen non è impostato, tutte le versioni sono considerate nuove.
   * @param version - La SpecVersion da verificare
   * @returns `true` se la versione è più recente di lastSeen
   */
  isNew(version: SpecVersion): boolean {
    if (!this.lastSeenVersionId) return true;
    const lastIdx = this.versions.findIndex((v) => v.id === this.lastSeenVersionId);
    const myIdx = this.versions.findIndex((v) => v.id === version.id);
    return lastIdx !== -1 && myIdx < lastIdx;
  }

  /**
   * Verifica se la versione corrisponde all'ultima vista dall'utente.
   * @param version - La SpecVersion da verificare
   * @returns `true` se la versione è quella segnata come lastSeen
   */
  isLastSeen(version: SpecVersion): boolean {
    return version.id === this.lastSeenVersionId;
  }
}
