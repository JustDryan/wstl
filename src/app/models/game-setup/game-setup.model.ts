import { Alignment } from "../game-data/alignment.enum";
import { GridPosition, GridSize, isAdjacent, isInBounds, isNear, positionKey, positionOfSlot, Proximity, sameColumn, sameRow, slotNumber } from "./grid.model";
import { PlacedCharacter, PlacedCharacterData, RevealData } from "./placed-character";

/** Bump when the JSON shape changes so older exports can be migrated. */
export const GAME_SETUP_VERSION = 4;

export type TeamCounts = Record<Alignment, number>;

/** Plain, JSON-serialisable shape of a whole puzzle – this is what the builder exports. */
export interface GameSetupData {
  version: number;
  id: string;
  title: string;
  /** Drives every "random" choice, so the same seed always produces the same puzzle. */
  seed: string;
  grid: GridSize;
  /** How many accusations the player gets at the thief. */
  maxGuesses: number;
  /** Placed-character id (e.g. "c4", not "looter") of the Scoundrel holding the loot. */
  thiefId?: string;
  script: string[];
  characters: PlacedCharacterData[];
}

export class GameSetup {
  readonly version: number;
  readonly id: string;
  readonly title: string;
  readonly seed: string;
  readonly grid: GridSize;
  readonly maxGuesses: number;
  readonly script: readonly string[];
  readonly characters: readonly PlacedCharacter[];

  private readonly byId = new Map<string, PlacedCharacter>();
  private readonly byPosition = new Map<string, PlacedCharacter>();

  constructor(data: GameSetupData) {
    this.version = data.version ?? GAME_SETUP_VERSION;
    this.id = data.id;
    this.title = data.title;
    this.seed = data.seed ?? data.id;
    this.grid = { rows: data.grid.rows, cols: data.grid.cols };
    this.maxGuesses = data.maxGuesses;
    this.characters = (data.characters ?? []).map((c) => new PlacedCharacter(c));
    this.script = [...(data.script ?? new Set(this.characters.map((c) => c.characterId)))];

    for (const pc of this.characters) {
      this.byId.set(pc.id, pc);
      this.byPosition.set(positionKey(pc.position), pc);
    }
  }

  // ---- Loading / exporting -------------------------------------------------

  static fromJson(json: string | GameSetupData): GameSetup {
    const data: GameSetupData = typeof json === 'string' ? JSON.parse(json) : json;
    if (data.version > GAME_SETUP_VERSION) {
      throw new Error(
        `Game setup version ${data.version} is newer than supported (${GAME_SETUP_VERSION}).`,
      );
    }
    return new GameSetup(data);
  }

  toJson(): GameSetupData {
    return {
      version: GAME_SETUP_VERSION,
      id: this.id,
      title: this.title,
      seed: this.seed,
      grid: { ...this.grid },
      maxGuesses: this.maxGuesses,
      script: [...this.script],
      characters: this.characters.map((c) => c.toJson()),
    };
  }

  toJsonString(pretty = true): string {
    return JSON.stringify(this.toJson(), null, pretty ? 2 : 0);
  }

  /** Returns a copy with the given reveals attached (used by resolveGame). */
  withReveals(reveals: ReadonlyMap<string, RevealData>): GameSetup {
    const data = this.toJson();
    data.characters = data.characters.map((c) => ({ ...c, reveal: reveals.get(c.id) ?? c.reveal }));
    return new GameSetup(data);
  }

  /** True once every character has a resolved reveal and the puzzle is ready to play. */
  get isResolved(): boolean {
    return this.characters.every((c) => !!c.reveal);
  }

  // ---- Lookups -------------------------------------------------------------

  getById(id: string): PlacedCharacter | undefined {
    return this.byId.get(id);
  }

  slotOf(pc: PlacedCharacter): number {
    return slotNumber(pc.position, this.grid);
  }
 
  /** The character in a slot, if any. */
  getAtSlot(slot: number): PlacedCharacter | undefined {
    const position = positionOfSlot(slot, this.grid);
    return position ? this.getAt(position) : undefined;
  }
 
  get slotCount(): number {
    return this.grid.rows * this.grid.cols;
  }

  getAt(position: GridPosition): PlacedCharacter | undefined {
    return this.byPosition.get(positionKey(position));
  }

  isInBounds(position: GridPosition): boolean {
    return isInBounds(position, this.grid);
  }
  
sameRow(pc: PlacedCharacter): PlacedCharacter[] {
    return this.characters.filter((o) => o.id !== pc.id && sameRow(o.position, pc.position));
    }
        sameColumn(pc: PlacedCharacter): PlacedCharacter[] {
    return this.characters.filter((o) => o.id !== pc.id && sameColumn(o.position, pc.position));
    }

  charactersNear(pc: PlacedCharacter, proximity: Proximity): PlacedCharacter[] {
    return this.characters.filter((o) => o.id !== pc.id && isNear(o.position, pc.position, proximity));
  }

  /** In-play characters touching this one. */
  adjacentTo(pc: PlacedCharacter): PlacedCharacter[] {
    return this.charactersNear(pc, Proximity.Adjacent);
  }
 
  /** Characters in any of the eight surrounding cells. */
  closeTo(pc: PlacedCharacter): PlacedCharacter[] {
    return this.charactersNear(pc, Proximity.Close);
  }
 
  /** Characters diagonally NE, SE, SW or NW of this one. */
  cornersOf(pc: PlacedCharacter): PlacedCharacter[] {
    return this.charactersNear(pc, Proximity.Corner);
  }

  get thief(): PlacedCharacter | undefined {
    return this.characters.find((c) => c.hasLoot);
  }

  // ---- Validation (for the builder page) ----------------------------------

  /**
   * Returns a list of problems; an empty array means the puzzle is valid.
   * @param teamOf looks up a catalog character's team, e.g. CHARACTERS.teamOf
   */
  validate(teamOf: (characterId: string) => Alignment | undefined): string[] {
        const errors: string[] = [];
    const { rows, cols } = this.grid;
 
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
      errors.push(`Grid size must be positive whole numbers (got ${rows}x${cols}).`);
    }
    if (!Number.isInteger(this.maxGuesses) || this.maxGuesses < 1) {
      errors.push('There must be at least one guess.');
    }
 
    // Script
    if (this.script.length === 0) errors.push('The script must list at least one character.');
    const scriptIds = new Set<string>();
    for (const characterId of this.script) {
      if (scriptIds.has(characterId)) errors.push(`"${characterId}" is on the script twice.`);
      scriptIds.add(characterId);
      if (!teamOf(characterId)) errors.push(`Script uses unknown character "${characterId}".`);
    }
 
    const seenIds = new Set<string>();
    const seenCells = new Map<string, string>();
    let scoundrels = 0;
 
    for (const pc of this.characters) {
      const key = positionKey(pc.position);
      const team = teamOf(pc.characterId);
 
      if (seenIds.has(pc.id)) errors.push(`Duplicate placed-character id "${pc.id}".`);
      seenIds.add(pc.id);
 
      if (!team) errors.push(`${pc.id} uses unknown character "${pc.characterId}".`);
      else if (!scriptIds.has(pc.characterId)) {
        errors.push(`${pc.id} is a "${pc.characterId}", which is not on the script.`);
      }
      if (team === Alignment.Scoundrel) scoundrels++;
 
      if (!this.isInBounds(pc.position)) errors.push(`${pc.id} is outside the grid at (${key}).`);
      const occupant = seenCells.get(key);
      if (occupant) errors.push(`${pc.id} and ${occupant} share cell (${key}).`);
      seenCells.set(key, pc.id);
    }
 
    if (scoundrels === 0) errors.push('There must be at least one Scoundrel.');
 
    // Loot – the author may hand it out before setup; abilities can move it during setup.
    const startingHolders = this.characters.filter((c) => c.startsWithLoot);
    if (startingHolders.length > 1) {
      errors.push(
        `Only one character can start with the loot (${startingHolders.map((c) => c.id).join(', ')}).`,
      );
    }
 
    // Once resolved, exactly one Scoundrel must end up holding it.
    if (this.isResolved) {
      const holders = this.characters.filter((c) => c.hasLoot);
      if (holders.length === 0) {
        errors.push('Nobody ends setup with the loot – add a Looter or Goblin, or set startsWithLoot.');
      } else if (holders.length > 1) {
        errors.push(`More than one character ends setup with the loot (${holders.map((c) => c.id).join(', ')}).`);
      } else if (teamOf(holders[0].characterId) !== Alignment.Scoundrel) {
        errors.push(`The loot ends up with ${holders[0].id}, who isn't a Scoundrel.`);
      }
    }
 
    return errors;
  }
}
