import { Component, Input, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { EndpointChange } from '../../../core/models/diff-report.model';

@Component({
  selector: 'app-endpoint-card',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './endpoint-card.html',
  styleUrl: './endpoint-card.scss',
})
export class EndpointCardComponent {
  @Input({ required: true }) change!: EndpointChange;
  expanded = signal(false);

  /**
   * Restituisce le classi CSS Tailwind per il badge del metodo HTTP.
   * @returns Stringa di classi CSS corrispondenti al metodo dell'endpoint
   */
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
