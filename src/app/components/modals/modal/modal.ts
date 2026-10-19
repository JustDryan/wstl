import { Component, effect, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-modal',
  imports: [],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  readonly open = input(false);
  /** Id of the heading inside the projected content, for screen readers. */
  readonly labelledBy = input<string>();
  readonly closed = output<void>();
 
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
 
  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.open()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }
 
  /** A click whose target is the dialog itself landed on the backdrop. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.dialog().nativeElement.close();
  }
}
