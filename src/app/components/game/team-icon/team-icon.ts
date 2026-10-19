import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Alignment } from '../../../models/game-data/alignment.enum';

@Component({
  selector: 'app-team-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      @switch (team()) {
        @case (Alignment.Regular) {
          <path d="M12 3l7 3v6c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6l7-3z" />
        }
        @case (Alignment.Bystander) {
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5" />
        }
        @case (Alignment.Scoundrel) {
          <path d="M20 4l-1 5-7.5 7.5-3-3L16 6z" />
          <path d="M7 12.5l4.5 4.5" />
          <path d="M9 15l-5 5" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
      flex: none;
    }
    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class TeamIconComponent {
  readonly team = input.required<Alignment>();
  protected readonly Alignment = Alignment;
}
 
