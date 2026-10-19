import { CharacterRegistry } from "../../game/character-registry";
import { GameSetup } from "../game-setup/game-setup.model";
import { PlacedCharacter } from "../game-setup/placed-character";
import { Alignment } from "./alignment.enum";
import { CharacterDefinition } from "./character.model";
import { Condition } from "./condition.enum";
import { Random } from "./random";
import { RevealAction } from "./reveal-action.model";
import { Script } from "./script.model";
import { Statement } from "./statement.model";

export enum AbilityKind {
  /** Gives the player information when the character is revealed. */
  Information = 'Information',
  /** Something the player can trigger after revealing the character. */
  Action = 'Action',
  /** Applies an effect just by the character being in the game. */
  Passive = 'Passive',
}

/**
 * An identity a character shows up as when *another ability* gathers
 * information about them. Does not change what their own card reveals.
 */
export interface Registration {
  characterId: string;
  team: Alignment;
}

export const SetupPriority = {
  /** Protections and redirections that must be in place before anyone acts (Cleric, Shield Bearer). */
  Protection: 50,
  /** Who starts with the loot (e.g. the Looter). */
  StartingLoot: 100,
   /** Fixing what characters register as (e.g. the Mesmer), before anything reads it. */
  Registrations: 150,
  /** Conditions like Confused (e.g. the Bamboozler). */
  Conditions: 200,
  /** Effects that pass the loot around mid-setup. */
  MoveLoot: 300,
  /** Learning how setup went, before last-minute changes (e.g. the Ledger). */
  Observe: 900,
  /** Must have the final say, whatever ran before (e.g. the Goblin). */
  Final: 1000,
} as const;
 
/** The shared state setup steps read and change. Created fresh by resolveGame. */
export interface SetupState {
  conditionsOf(target: PlacedCharacter): ReadonlySet<Condition>;
  applyCondition(target: PlacedCharacter, condition: Condition): void;
  /** Who currently holds the loot, if anyone. */
  readonly lootHolder: PlacedCharacter | undefined;
  /** Moves the loot to `target` (taking it from whoever had it). */
  giveLoot(target: PlacedCharacter): void;
  setRegistrations(target: PlacedCharacter, registrations: readonly Registration[]): void;
  /** Protects `target` from negative effects for the rest of setup. */
  protect(target: PlacedCharacter, by: PlacedCharacter): void;
  isProtected(target: PlacedCharacter): boolean;

  /**
   * Makes `target` absorb the next Scoundrel ability that picks a target
   * (the Shield Bearer).
   */
  drawFire(target: PlacedCharacter): void;
  /**
   * How an ability picks who it's used on. Normally a seeded random pick from
   * `candidates`, but the first Scoundrel ability to call this is forced onto
   * a Shield Bearer if one is drawing fire. Abilities that are "used on"
   * someone should always pick through this.
   */
  pickTarget(ctx: AbilityContext, candidates: readonly PlacedCharacter[]): PlacedCharacter | undefined;

  /** Stores something the owner learned during setup, read back with ctx.recall(key). */
  remember(owner: PlacedCharacter, key: string, value: unknown): void;
}

/** The reveal being built up as each of a character's abilities runs. */
export interface RevealDraft {
  shownAs: string;
  statements: Statement[];
  action?: RevealAction;
}

/** Everything an ability can see while it runs. */
export interface AbilityContext {
  readonly game: GameSetup;
  readonly catalog: CharacterRegistry;
  /** This puzzle's script – pick "possible" characters from here, not the catalog. */
  readonly script: Script;
  /** The character that owns this ability. */
  readonly self: PlacedCharacter;
  readonly definition: CharacterDefinition;
  readonly rng: Random;
  /** True if the owner is lying or confused. */
  readonly isMisinformed: boolean;
  conditionsOf(target: PlacedCharacter): ReadonlySet<Condition>;
  /** Picks what `target` registers as for this ability's information. */
  registrationOf(target: PlacedCharacter): Registration;
  /** Every identity `target` could register as (useful for making sure a lie is actually false). */
  possibleRegistrations(target: PlacedCharacter): readonly Registration[];
  /** What the owner stored with setup.remember(owner, key, …), if anything. */
  recall<T>(key: string): T | undefined;
  /** Everyone who has held the loot so far, in order (the whole trail once setup is over). */
  readonly lootTrail: readonly PlacedCharacter[];
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  kind: AbilityKind;

  /** When onSetup runs relative to other abilities – see SetupPriority. Defaults to Conditions. */
  setupPriority?: number;
 
  /**
   * Runs once during setup, before anyone is revealed, in priority order.
   * Use it to hand out or move the loot, confuse characters, etc.
   */
  onSetup?(ctx: AbilityContext, setup: SetupState): void;

  /** Runs when the owner is revealed; may change who they show as and add statements. */
  onReveal?(ctx: AbilityContext, reveal: RevealDraft): void;

  /** Every identity the owner may register as. Defaults to their true character and team. */
  registersAs?(owner: CharacterDefinition, script: Script): readonly Registration[];

  actEvery?: number;
}