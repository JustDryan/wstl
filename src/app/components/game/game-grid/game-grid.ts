import { Component, computed, input, output } from '@angular/core';
import { GameSetup } from '../../../models/game-setup/game-setup.model';
import { CharacterCard } from '../character-card/character-card';
import { PlacedCharacter } from '../../../models/game-setup/placed-character';
import { CardNote } from '../../../game/game-notes';
import { BoardMode } from '../../../services/game.service';
import { slotNumber } from '../../../models/game-setup/grid.model';
import { Statement } from '../../../models/game-data/statement.model';

interface GridCell {
  key: string;
  slot: number;
  character?: PlacedCharacter;
}

@Component({
  selector: 'app-game-grid',
  imports: [CharacterCard],
  templateUrl: './game-grid.html',
  styleUrl: './game-grid.css',
})
export class GameGrid {
  
  readonly game = input.required<GameSetup>();
  readonly revealedIds = input<ReadonlySet<string>>(new Set());
 /** The player's notes, by placed-character id. */
  readonly notes = input<ReadonlyMap<string, CardNote>>(new Map());
  /** Placed-character ids the player has accused. */
  readonly accusedIds = input<ReadonlySet<string>>(new Set());
  /** The full solution is showing. */
  readonly solved = input(false);
  /** The game is over: face-down cards can't be flipped. */
  readonly locked = input(false);
  /** What clicking a card does. */
  readonly mode = input<BoardMode>('reveal');
  /** Statements from actions the player has used, by owner id. */
  readonly actionStatements = input<ReadonlyMap<string, readonly Statement[]>>(new Map());
  /** The card whose action is waiting for a target, if any. */
  readonly pendingActionId = input<string | null>(null);
  /** In target mode, the ids of cards that can be picked. */
  readonly targetableIds = input<ReadonlySet<string>>(new Set());
  
  /** Emits a placed character's id when its card is clicked while face down. */
  readonly cardFlipped = output<string>();
   /** Emits a character id when a revealed card is clicked for details. */
  readonly cardInspected = output<string>();
  /** Emits a placed character's id when its card is clicked in notes mode. */
  readonly cardNoted = output<string>();
  /** Emits a placed character's id when its card is clicked in accuse mode. */
  readonly cardAccused = output<string>();
  /** Emits a placed character's id when its card is picked as an action's target. */
  readonly cardTargeted = output<string>();
  
  /** Every cell, row by row, with the character in it (if any). */
  protected readonly cells = computed<GridCell[]>(() => {
    const game = this.game();
    const cells: GridCell[] = [];
    for (let row = 0; row < game.grid.rows; row++) {
      for (let col = 0; col < game.grid.cols; col++) {
        const position = { row, col };
        cells.push({ 
          key: `${row},${col}`, 
          slot: slotNumber(position, game.grid),
          character: game.getAt({ row, col }) });
      }
    }
    return cells;
  });
}
