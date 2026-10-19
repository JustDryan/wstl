import { Component, effect, ElementRef, input, output, viewChild } from '@angular/core';
import { CharacterDefinition } from '../../../models/game-data/character.model';
import { TeamIconComponent } from '../../game/team-icon/team-icon';

@Component({
  selector: 'app-character-info-dialog',
  imports: [TeamIconComponent],
  templateUrl: './character-info-dialog.html',
  styleUrl: './character-info-dialog.css',
})
export class CharacterInfoDialog {
  readonly character = input<CharacterDefinition | null>(null);
  readonly closed = output<void>();
 
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
 
  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.character()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }
 
  protected close(): void {
    // Fires the dialog's 'close' event, which emits `closed`.
    this.dialog().nativeElement.close();
  }
 
  /** The dialog has no padding, so a click whose target is the dialog itself hit the backdrop. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}
