import { Component, computed, input, output } from '@angular/core';
import { CHARACTERS } from '../../../game/character-registry';
import { PlacedCharacter } from '../../../models/game-setup/placed-character';
import { describeStatement, isStatementTrue, Statement } from '../../../models/game-data/statement.model';
import { TeamIconComponent } from '../team-icon/team-icon';
import { CardNote } from '../../../game/game-notes';
import { Alignment } from '../../../models/game-data/alignment.enum';
import { GameSetup } from '../../../models/game-setup/game-setup.model';
import { BoardMode } from '../../../services/game.service';

interface StatementView {
  text: string;
  /** Only known once the solution is revealed; null before that. */
  truth: boolean | null;
}

@Component({
  selector: 'app-character-card',
  imports: [TeamIconComponent],
  templateUrl: './character-card.html',
  styleUrl: './character-card.css',
})
export class CharacterCard {
  readonly game = input.required<GameSetup>();
  readonly character = input.required<PlacedCharacter>();
  readonly revealed = input(false);
  /** The player has accused this card, so its true identity is shown. */
  readonly accused = input(false);
  /** The full solution is showing. */
  readonly solved = input(false);
  /** The game is over: face-down cards can no longer be flipped. */
  readonly locked = input(false);
  readonly mode = input<BoardMode>('reveal');
  /** The player's note on this card, if any. */
  readonly note = input<CardNote | null>(null);
    /** Statements from actions the player has used with this card (e.g. a Clairvoyant reading). */
  readonly actionStatements = input<readonly Statement[]>([]);
  /** This card's action is waiting for the player to pick a target. */
  readonly awaitingTarget = input(false);
  /** In target mode: this card can be picked. */
  readonly targetable = input(false);
  
  /** Emits the placed character's id when a face-down card is clicked. */
  readonly flip = output<string>();
  readonly inspect = output<string>();
  /** Emits the placed character's id when the card is clicked in notes mode. */
  readonly noteRequested = output<string>();
  /** Emits the placed character's id when the card is clicked in accuse mode. */
  readonly accuseRequested = output<string>();
  /** Emits the placed character's id when the card is picked as an action's target. */
  readonly targetRequested = output<string>();

  /** Accused or solved cards show the truth instead of the claim. */
  protected readonly showTruth = computed(() => this.accused() || this.solved());
 
  /** The identity on the card: their claim normally, their real character once the truth is out. */
  protected readonly displayed = computed(() => {
    const pc = this.character();
    const id = this.showTruth() ? pc.characterId : pc.reveal?.shownAs;
    return id ? CHARACTERS.get(id) : undefined;
  });
 
  /** Who they claimed to be, when the truth turned out to be different. */
  protected readonly claimed = computed(() => {
    const shownAs = this.character().reveal?.shownAs;
    if (!this.showTruth() || !shownAs || shownAs === this.character().characterId) return null;
    return CHARACTERS.get(shownAs)?.name ?? null;
  });
 
  protected readonly slot = computed(() => this.game().slotOf(this.character()));
  protected readonly isThief = computed(() => this.character().hasLoot);
 
  /** Badge across the top once the truth is out. */
  protected readonly stamp = computed<'thief' | 'not-thief' | null>(() => {
    if (!this.showTruth()) return null;
    if (this.isThief()) return 'thief';
    return this.accused() ? 'not-thief' : null;
  });
 
  /** Lying / Confused – only revealed with the full solution. */
  protected readonly conditions = computed(() =>
    this.solved() ? (this.character().reveal?.conditions ?? []) : [],
  );
 
  protected readonly statements = computed<StatementView[]>(() => {
    const pc = this.character();
    const game = this.game();
    const solved = this.solved();
    return [...(pc.reveal?.statements ?? []), ...this.actionStatements()].map((s) => ({
      text: describeStatement(s),
      truth: solved ? isStatementTrue(s, pc, game) : null,
    }));
  });
 
  /** Colour the card by the team it appears to be on (their real team once the truth is out). */
  protected readonly teamClass = computed(
    () => `team-${(this.displayed()?.team ?? 'unknown').toLowerCase()}`,
  );
 
  /** Can be picked in accuse mode (not already accused). */
  protected readonly canAccuse = computed(() => this.mode() === 'accuse' && !this.accused());
 
  /** Clicking does nothing: already accused in accuse mode, or face down after the game ends. */
  protected readonly unavailable = computed(() => {
    if (this.mode() === 'accuse') return this.accused();
    if (this.mode() === 'notes') return false;
    return this.locked() && !this.revealed();
  });
 
  /** What the note tag at the bottom of the card shows. */
  protected readonly noteTag = computed<{ team: Alignment; text: string } | null>(() => {
    const note = this.note();
    if (!note) return null;
    if (note.kind === 'team') return { team: note.team, text: note.team };
    const character = CHARACTERS.get(note.characterId);
    return character ? { team: character.team, text: character.name } : null;
  });
 
  protected readonly label = computed(() => {
    const { row, col } = this.character().position;
    const where = `row ${row + 1}, column ${col + 1}`;
 
    let description: string;
    if (!this.revealed()) {
      description = `Hidden character at ${where}.`;
    } else {
      const shown = this.displayed();
      const parts = [`${shown?.name ?? 'Unknown'} (${shown?.team ?? 'unknown team'}) at ${where}.`];
      const claimed = this.claimed();
      if (claimed) parts.push(`Claimed to be the ${claimed}.`);
      const stamp = this.stamp();
      if (stamp === 'thief') parts.push('The thief.');
      if (stamp === 'not-thief') parts.push('Accused – not the thief.');
      const conditions = this.conditions();
      if (conditions.length) parts.push(`Was ${conditions.join(' and ').toLowerCase()}.`);
      for (const s of this.statements()) {
        const truth = s.truth === null ? '' : s.truth ? ' (true)' : ' (false)';
        parts.push(`Says: ${s.text}${truth}`);
      }
      description = parts.join(' ');
    }
 
    const note = this.noteTag();
    const noteText = note ? ` Your note: ${note.text}.` : '';
 
    let action = '';
    if (this.awaitingTarget()) action = 'Choose a face-down card to use this on.';
    else if (this.mode() === 'target') action = this.targetable() ? 'Select to use the ability on this card.' : '';
    else if (this.mode() === 'notes') action = 'Select to apply your selected note.';
    else if (this.mode() === 'accuse') action = this.accused() ? 'Already accused.' : 'Select to accuse.';
    else if (this.revealed()) action = 'Select for details.';
    else if (!this.locked()) action = 'Select to reveal.';
 
    return `${description}${noteText} ${action}`.trim();
  });
 
protected onClick(): void {
const id = this.character().id;
    switch (this.mode()) {
      case 'notes':
        this.noteRequested.emit(id);
        return;
      case 'accuse':
        if (!this.accused()) this.accuseRequested.emit(id);
        return;
      case 'target':
        if (this.targetable()) this.targetRequested.emit(id);
        return;
      case 'reveal': {
        if (!this.revealed()) {
          if (!this.locked()) this.flip.emit(id);
          return;
        }
        const shown = this.displayed();
        if (shown) this.inspect.emit(shown.id);
      }
    }
  }
}
