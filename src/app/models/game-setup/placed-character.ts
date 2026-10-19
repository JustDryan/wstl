import { GridPosition } from "./grid.model";
import { Condition } from "../game-data/condition.enum";
import { Statement } from "../game-data/statement.model";
import { Registration } from "../game-data/character-registraion.model";
import { copyRevealAction, RevealAction } from "../game-data/reveal-action.model";

export interface HexedReveal {
  shownAs: string;
  statements: Statement[];
  action?: RevealAction;
}

/** What the player sees when the card is flipped. Produced by resolveGame(). */
export interface RevealData {
  /** Character id shown on the card: their real one, or who they're pretending to be. */
  shownAs: string;
  statements: Statement[];
  /** Whether they were lying/confused when this was generated – shown at the end of the game. */
  conditions: Condition[];
  hasLoot: boolean;
  /**
   * What setup decided they register as (e.g. the Regular a Mesmer picked).
   * Only stored when setup fixed it; otherwise their abilities' registersAs applies.
   */
  registersAs?: Registration[];
  /** Held the loot at some point during setup, even if someone took it later. */
  heldLoot?: boolean;
  /** Placed-character id of whoever protected them during setup (e.g. a Cleric). */
  protectedBy?: string;
  /** Something the player does after flipping this card (e.g. the Clairvoyant's reading). */
  action?: RevealAction;
    /** This card's reveal if a Hexxer makes it Confused. Only on Regulars that could be hexed. */
  hexed?: HexedReveal;
  /** On a Hexxer: every Nth Regular card flipped is Confused. */
  hexEvery?: number;
}

/** Plain, JSON-serialisable shape of one character placed in a puzzle. */
export interface PlacedCharacterData {
  /** Unique within this puzzle, e.g. "c1". Two Squires in one puzzle get different ids. */
  id: string;
  /** Which character from the catalog, e.g. "squire". */
  characterId: string;
  position: GridPosition;
  /** Conditions the puzzle author sets directly, on top of team defaults and ability effects. */
  conditions?: Condition[];
  /** Some puzzles may want a character face-up from the start. */
  startsRevealed?: boolean;
  startsWithLoot?: boolean;
  /** Filled in by resolveGame(); stored so a published puzzle never changes. */
  reveal?: RevealData;
}

const copyReveal = (r: RevealData): RevealData => ({
  shownAs: r.shownAs,
  statements: r.statements.map((s) => ({ ...s })),
  conditions: [...r.conditions],
  hasLoot: r.hasLoot ?? false,
  ...(r.registersAs ? { registersAs: r.registersAs.map((x) => ({ ...x })) } : {}),
  ...(r.heldLoot ? { heldLoot: true } : {}),
  ...(r.protectedBy ? { protectedBy: r.protectedBy } : {}),
  ...(r.action ? { action: copyRevealAction(r.action) } : {}),
  ...(r.hexed
    ? {
        hexed: {
          shownAs: r.hexed.shownAs,
          statements: r.hexed.statements.map((s) => ({ ...s })),
          ...(r.hexed.action ? { action: copyRevealAction(r.hexed.action) } : {}),
        },
      }
    : {}),
  ...(r.hexEvery ? { hexEvery: r.hexEvery } : {}),
});

/** A character as they appear in a specific puzzle. */
export class PlacedCharacter {
  readonly id: string;
  readonly characterId: string;
  readonly position: GridPosition;
  readonly startsRevealed: boolean;
  readonly startsWithLoot: boolean;
  readonly reveal?: RevealData;

  constructor(data: PlacedCharacterData) {
    this.id = data.id;
    this.characterId = data.characterId;
    this.position = { row: data.position.row, col: data.position.col };
    this.startsRevealed = data.startsRevealed ?? false;
    this.startsWithLoot = data.startsWithLoot ?? false;
    this.reveal = data.reveal ? copyReveal(data.reveal) : undefined;
  }

  get hasLoot(): boolean {
    return this.reveal?.hasLoot ?? false;
  }

  toJson(): PlacedCharacterData {
return {
      id: this.id,
      characterId: this.characterId,
      position: { ...this.position },
      ...(this.startsRevealed ? { startsRevealed: true } : {}),
      ...(this.startsWithLoot ? { startsWithLoot: true } : {}),
      ...(this.reveal ? { reveal: copyReveal(this.reveal) } : {}),
    };
  }
}