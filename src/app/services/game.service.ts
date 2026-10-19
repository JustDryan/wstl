import { computed, Injectable, signal } from '@angular/core';
import { GameSetup, GameSetupData } from '../models/game-setup/game-setup.model';
import { resolveGame } from '../game/resolve-game';
import { CardNote, NoteBrush, sameNote } from '../game/game-notes';
import { Statement } from '../models/game-data/statement.model';
import { PlacedCharacter, RevealData } from '../models/game-setup/placed-character';
import { Condition } from '../models/game-data/condition.enum';
import { CHARACTERS } from '../game/character-registry';
import { Alignment } from '../models/game-data/alignment.enum';

/** What tapping a card does: flip/inspect it, label it, or accuse it. */
export type BoardMode = 'reveal' | 'notes' | 'accuse' | 'target';
 
export type GameStatus = 'playing' | 'won' | 'lost';
 
/** The outcome of one accusation, for the result modal. */
export interface AccusationResult {
  /** Placed-character id that was accused. */
  id: string;
  /** Who they really are (their true character, not their claim). */
  characterId: string;
  correct: boolean;
  guessesLeft: number;
  status: GameStatus;
}

@Injectable({
  providedIn: 'root',
})
export class GameService {

  /** The resolved puzzle as loaded, before any hexes. */
  private readonly baseSetupState = signal<GameSetup | null>(null);
  /** Regular cards the Hexxer has made Confused, in this playthrough. */
  private readonly hexedState = signal<ReadonlySet<string>>(new Set());
  /** How many Regular cards the player has flipped (for the Hexxer). */
  private readonly regularFlipsState = signal(0);
  private readonly revealedState = signal<ReadonlySet<string>>(new Set());
  private readonly notesState = signal<ReadonlyMap<string, CardNote>>(new Map());
  private readonly notesModeState = signal(false);
  private readonly brushState = signal<NoteBrush | null>(null);
  private readonly modeState = signal<BoardMode>('reveal');
  private readonly accusedState = signal<ReadonlySet<string>>(new Set());
  private readonly solvedState = signal(false);
  private readonly pendingActionState = signal<string | null>(null);
  private readonly actionTargetsState = signal<ReadonlyMap<string, string>>(new Map());

  /** The resolved puzzle, or null before one is loaded. */
  readonly setup = computed<GameSetup | null>(() => {
    const base = this.baseSetupState();
    const hexed = this.hexedState();
    if (!base || hexed.size === 0) return base;
 
    const reveals = new Map<string, RevealData>();
    for (const id of hexed) {
      const r = base.getById(id)?.reveal;
      if (!r?.hexed) continue;
      reveals.set(id, {
        ...r,
        shownAs: r.hexed.shownAs,
        statements: r.hexed.statements,
        action: r.hexed.action,
        conditions: [...r.conditions, Condition.Confused],
      });
    }
    return reveals.size ? base.withReveals(reveals) : base;
  });
  /** Every Nth Regular flipped is Confused while a Hexxer is in play; null if there's no Hexxer. */
  readonly hexEvery = computed(() => {
    const values = (this.baseSetupState()?.characters ?? [])
      .map((c) => c.reveal?.hexEvery)
      .filter((n): n is number => !!n);
    return values.length ? Math.min(...values) : null;
  });
  /** Ids of placed characters that are face up. */
  readonly revealedIds = this.revealedState.asReadonly();
   /** The player's notes, by placed-character id. */
  readonly notes = this.notesState.asReadonly();
  /** The label tapping a card will apply in notes mode, or null if none picked yet. */
  readonly brush = this.brushState.asReadonly();
  /** What tapping a card currently does. */
  readonly mode = this.modeState.asReadonly();
  /** Ids of placed characters the player has accused. Their true identity is shown. */
  readonly accusedIds = this.accusedState.asReadonly();
  /** True once the full solution is showing: every card's true identity, lies and confusion. */
  readonly solved = this.solvedState.asReadonly();
  /** A flipped card whose action is waiting for the player to pick a target, or null. */
  readonly pendingActionId = this.pendingActionState.asReadonly();
  /** Which card each action was used on: owner id → target id. */
  readonly actionTargets = this.actionTargetsState.asReadonly();
  
    /**
   * Statements that come from actions the player has used, by owner id –
   * e.g. a Clairvoyant used on #4 says "#4 is a Scoundrel."
   */
  readonly actionStatements = computed(() => {
    const setup = this.setup();
    const result = new Map<string, Statement[]>();
    if (!setup) return result;
    for (const [ownerId, targetId] of this.actionTargets()) {
      const action = setup.getById(ownerId)?.reveal?.action;
      const target = setup.getById(targetId);
      const team = action?.answers[targetId];
      if (action?.kind === 'ReadTeam' && target && team) {
        result.set(ownerId, [{ kind: 'TeamOf', slot: setup.slotOf(target), team }]);
      }
    }
    return result;
  });

  readonly guessesLeft = computed(() => {
    const max = this.setup()?.maxGuesses ?? 0;
    return Math.max(0, max - this.accusedIds().size);
  });
 
  readonly status = computed<GameStatus>(() => {
    const setup = this.setup();
    if (!setup) return 'playing';
    const thief = setup.thief;
    if (thief && this.accusedIds().has(thief.id)) return 'won';
    if (this.guessesLeft() === 0) return 'lost';
    return 'playing';
  });
 
  readonly isOver = computed(() => this.status() !== 'playing');
 
  /** Loads a puzzle, resolving it first if the builder hasn't already. */
  load(puzzle: GameSetup | GameSetupData | string): void {
    const setup = puzzle instanceof GameSetup ? puzzle : GameSetup.fromJson(puzzle);
    const resolved = setup.isResolved ? setup : resolveGame(setup);
    this.baseSetupState.set(resolved);
    this.clearProgress(resolved);
  }

  /** Flips a card face up. Does nothing if it's unknown or already revealed. */
  reveal(id: string): void {
    const pc = this.setup()?.getById(id);
    if (!pc || this.isOver() || this.pendingActionId() || this.revealedIds().has(id)) return;
 
    this.applyHex(pc);
    this.revealedState.update((prev) => new Set(prev).add(id));
 
    // Re-read the card: if it was just hexed, its action (e.g. a Clairvoyant's) changed.
    const shown = this.setup()?.getById(id);
    if (shown?.reveal?.action && this.targetsFor(shown).length > 0) {
      this.pendingActionState.set(id);
      this.modeState.set('target');
    }
  }
 
  /** Counts Regular flips for the Hexxer; every Nth one is Confused. */
  private applyHex(pc: PlacedCharacter): void {
    const every = this.hexEvery();
    if (!every || CHARACTERS.teamOf(pc.characterId) !== Alignment.Regular) return;
    const count = this.regularFlipsState() + 1;
    this.regularFlipsState.set(count);
    if (count % every === 0) this.hexedState.update((prev) => new Set(prev).add(pc.id));
  }

  /** Face-down cards the given card's action could be used on. */
  targetsFor(owner: PlacedCharacter): PlacedCharacter[] {
    const action = owner.reveal?.action;
    if (!action) return [];
    return (this.setup()?.characters ?? []).filter(
      (c) => c.id !== owner.id && !this.revealedIds().has(c.id) && c.id in action.answers,
    );
  }

  /** Can the pending action be used on this card? */
  isTargetable(id: string): boolean {
    const owner = this.setup()?.getById(this.pendingActionId() ?? '');
    return !!owner && this.targetsFor(owner).some((c) => c.id === id);
  }

  /** Uses the pending action on a face-down card. The card stays face down. */
  chooseTarget(targetId: string): void {
    const ownerId = this.pendingActionId();
    if (!ownerId || !this.isTargetable(targetId)) return;
    this.actionTargetsState.update((prev) => new Map(prev).set(ownerId, targetId));
    this.pendingActionState.set(null);
    this.modeState.set('reveal');
  }

  isRevealed(id: string): boolean {
    return this.revealedIds().has(id);
  }

  setMode(mode: BoardMode): void {
    if (mode === 'accuse' && this.isOver()) return;
    this.modeState.set(mode);
  }

  // ---- Notes -----------------------------------------------------------------
 
  startNotes(): void {
    this.setMode('notes');
  }
 
  /** Picks the label to apply, and turns notes mode on so the next tap uses it. */
  selectBrush(brush: NoteBrush): void {
    this.brushState.set(brush);
    this.notesModeState.set(true);
  }

  clearBrushSelection():void{
    this.brushState.set(null);
  }
 
  /**
   * Applies the current brush to a card. Applying the label a card already has
   * removes it, so tapping twice undoes a mistake.
   */
  applyNote(id: string): void {
    const brush = this.brush();
    if (!brush || !this.setup()?.getById(id)) return;
 
    this.notesState.update((prev) => {
      const notes = new Map(prev);
      if (brush.kind === 'clear' || sameNote(prev.get(id), brush)) notes.delete(id);
      else notes.set(id, brush);
      return notes;
    });
  }
 
  clearNotes(): void {
    this.notesState.set(new Map());
  }
 
 // ---- Accusations -------------------------------------------------------------
 
  /** Switches to accuse mode (leaving notes mode). Ignored once the game is over. */
  startAccusing(): void {
    this.setMode('accuse');
  }
 
  /**
   * Locks in an accusation: uses a guess, flips the card and shows who they
   * really are. Their lying/confused state stays hidden until the solution is
   * revealed. Running out of guesses reveals the solution automatically.
   * Returns null if the accusation isn't allowed (game over, unknown or already accused).
   */
  accuse(id: string): AccusationResult | null {
    const setup = this.setup();
    const target = setup?.getById(id);
    if (!setup || !target || this.isOver() || this.accusedIds().has(id)) return null;
 
    this.accusedState.update((prev) => new Set(prev).add(id));
    this.revealedState.update((prev) => new Set(prev).add(id));
    this.modeState.set('reveal');
 
    const status = this.status();
    if (status === 'lost') this.solvedState.set(true);
 
    return {
      id,
      characterId: target.characterId,
      correct: target.hasLoot,
      guessesLeft: this.guessesLeft(),
      status,
    };
  }
 
  /** Shows the full solution. Only allowed once the game is over. */
  revealSolution(): void {
    if (this.isOver()) this.solvedState.set(true);
  }
 
  // ---- Reset -------------------------------------------------------------------
 
  /** Starts the puzzle again from scratch: cards, notes, guesses and modes. */
  reset(): void {
    const setup = this.setup();
    if (setup) this.clearProgress(setup);
  }
 
  private clearProgress(setup: GameSetup): void {
    this.revealedState.set(
      new Set(setup.characters.filter((c) => c.startsRevealed).map((c) => c.id)),
    );
    this.notesState.set(new Map());
    this.brushState.set(null);
    this.modeState.set('reveal');
    this.accusedState.set(new Set());
    this.solvedState.set(false);
    this.pendingActionState.set(null);
    this.actionTargetsState.set(new Map());
    this.hexedState.set(new Set());
    this.regularFlipsState.set(0);
  }
}
