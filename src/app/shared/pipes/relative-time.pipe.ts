import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'relativeTime', standalone: true })
export class RelativeTimePipe implements PipeTransform {
  transform(value: Date | null | undefined): string {
    if (!value) return '\u2014';
    const diff = Date.now() - value.getTime();
    const m = Math.floor(diff / 60_000);
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (m < 1) return 'adesso';
    if (m < 60) return `${m}m fa`;
    if (h < 24) return `${h}h fa`;
    if (d === 1) return 'ieri';
    if (d < 30) return `${d}g fa`;
    return value.toLocaleDateString('it-IT');
  }
}
