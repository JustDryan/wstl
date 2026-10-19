import { Component, computed, inject, signal } from '@angular/core';
import { Script } from '../../../models/game-data/script.model';
import { AccusationResult, GameService } from '../../../services/game.service';
import { GameGrid } from '../../game/game-grid/game-grid';
import { SAMPLE_PUZZLE } from '../../../data/sample-puzzle';
import { SAMPLE_PUZZLE_2 } from '../../../data/sample-puzzle-2';
import { TeamIconComponent } from '../../game/team-icon/team-icon';
import { Alignment } from '../../../models/game-data/alignment.enum';
import { CharacterInfoDialog } from '../../dialog/character-info-dialog/character-info-dialog';
import { CharacterDefinition } from '../../../models/game-data/character.model';
import { CHARACTERS } from '../../../game/character-registry';
import { characterNote, CLEAR_BRUSH, sameNote, teamNote } from '../../../game/game-notes';
import { Modal } from '../../modals/modal/modal';

const TEAM_ORDER = [Alignment.Regular, Alignment.Bystander, Alignment.Scoundrel];

const nameOf = (characterId: string | undefined): string =>
  (characterId && CHARACTERS.get(characterId)?.name) || 'Unknown';

@Component({
  selector: 'app-play-page',
  imports: [GameGrid, TeamIconComponent, CharacterInfoDialog, Modal],
  templateUrl: './play-page.html',
  styleUrl: './play-page.css',
})
export class PlayPage {
  protected readonly game = inject(GameService);
  protected readonly Alignment = Alignment;

  /** The characters that could be in this puzzle, for the reference list. */
  protected readonly scriptGroups = computed(() => {
    const setup = this.game.setup();
    if (!setup) return [];
    const script = Script.forGame(setup);
    return TEAM_ORDER.map((team) => ({ 
      team, 
      inPlay: script.inPlayCount(team) ?? 0, 
      characters: script.byTeam(team) })).filter(
      (group) => group.characters.length > 0,
    );
  });

  /** Name the card waiting for a target is showing (e.g. "Clairvoyant"), or null. */
  protected readonly pendingActionName = computed(() => {
    const pc = this.game.setup()?.getById(this.game.pendingActionId() ?? '');
    return pc ? nameOf(pc.reveal?.shownAs) : null;
  });

  /** Cards the pending action can be used on. */
  protected readonly targetableIds = computed<ReadonlySet<string>>(() => {
    const pc = this.game.setup()?.getById(this.game.pendingActionId() ?? '');
    return new Set(pc ? this.game.targetsFor(pc).map((c) => c.id) : []);
  });
 
  protected readonly selectedCharacter = signal<CharacterDefinition | null>(null);
  protected showCharacter(characterId: string): void {
    this.selectedCharacter.set(CHARACTERS.get(characterId) ?? null);
  }

  /** One pip per guess. Guessing isn't built yet, so this is the full allowance. */
  protected readonly guessSlots = computed(() =>
    Array.from({ length: this.game.setup()?.maxGuesses ?? 0 }),
  );
 
  // ---- Notes panel -----------------------------------------------------------
 
  protected toggleNotesMode(): void {
    if (this.game.mode() === 'notes'){
      this.game.setMode('reveal');
      this.game.clearBrushSelection();
    }
    else this.game.startNotes();
  }

  protected selectTeam(team: Alignment): void {
    if(this.game.mode() != 'notes'){
      this.toggleNotesMode();
    }
    this.game.selectBrush(teamNote(team));
  }
 
  protected selectCharacter(characterId: string): void {
    if(this.game.mode() != 'notes'){
      this.toggleNotesMode();
    }
    this.game.selectBrush(characterNote(characterId));
  }
 
  protected selectClear(): void {
    if(this.game.mode() != 'notes'){
      this.toggleNotesMode();
    }
    this.game.selectBrush(CLEAR_BRUSH);
  }
 
  protected isTeamSelected(team: Alignment): boolean {
    return sameNote(this.game.brush(), teamNote(team));
  }
 
  protected isCharacterSelected(characterId: string): boolean {
    return sameNote(this.game.brush(), characterNote(characterId));
  }
 
  protected isClearSelected(): boolean {
    return sameNote(this.game.brush(), CLEAR_BRUSH);
  }
 
// ---- Accusations -----------------------------------------------------------
 
  /** Card awaiting the "are you sure?" confirmation. */
  protected readonly pendingAccusation = signal<string | null>(null);
  /** Outcome of the accusation just made, shown in the result modal. */
  protected readonly accusationResult = signal<AccusationResult | null>(null);
 
  protected toggleAccuseMode(): void {
    if (this.game.mode() === 'accuse') this.game.setMode('reveal');
    else this.game.startAccusing();
  }
 
  protected requestAccusation(id: string): void {
    if (!this.game.isOver()) this.pendingAccusation.set(id);
  }
 
  /** "No" – close the prompt but stay in accuse mode so they can pick again. */
  protected cancelAccusation(): void {
    this.pendingAccusation.set(null);
  }
 
  /** "Yes" – lock the accusation in and show the result. */
  protected confirmAccusation(): void {
    const id = this.pendingAccusation();
    this.pendingAccusation.set(null);
    if (!id) return;
    const result = this.game.accuse(id);
    if (result) this.accusationResult.set(result);
  }
 
  protected revealSolution(): void {
    this.game.revealSolution();
    this.accusationResult.set(null);
  }
 
  /** "the Fighter" if the card is face up, otherwise which slot the hidden card is. */
  protected readonly pendingName = computed(() => {
    const id = this.pendingAccusation();
    const pc = id ? this.game.setup()?.getById(id) : undefined;
    if (!pc) return '';
    if (this.game.isRevealed(pc.id)) return `the ${nameOf(pc.reveal?.shownAs)}`;
    return `the hidden character in slot #${this.game.setup()!.slotOf(pc)}`;
  });
 
  /** Wording for the result modal. */
  protected readonly resultView = computed(() => {
    const result = this.accusationResult();
    const setup = this.game.setup();
    if (!result || !setup) return null;
 
    const name = nameOf(result.characterId);
    const max = setup.maxGuesses;
    const used = max - result.guessesLeft;
 
    if (result.correct) {
      return {
        correct: true,
        gameOver: true,
        title: 'Great job!',
        message: `The ${name} had the loot all along!`,
        detail: `Solved with ${used} of ${max} ${max === 1 ? 'guess' : 'guesses'}.`,
      };
    }
 
    if (result.status === 'lost') {
      return {
        correct: false,
        gameOver: true,
        title: 'Unlucky',
        message: `The ${name} doesn't have the loot – and you're out of guesses.`,
        detail: `The ${nameOf(setup.thief?.characterId)} had it all along.`,
      };
    }
 
    const left = result.guessesLeft;
    return {
      correct: false,
      gameOver: false,
      title: 'Unlucky',
      message: `The ${name} doesn't have the loot.`,
      detail: `You have ${left} ${left === 1 ? 'guess' : 'guesses'} left.`,
    };
  });

  constructor() {
    // Demo puzzle for now – later this comes from the daily puzzle API.
    this.game.load(SAMPLE_PUZZLE_2);
  }
}
