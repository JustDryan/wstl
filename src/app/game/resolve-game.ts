import { Registration, AbilityContext, RevealDraft, SetupState, SetupPriority, Ability } from '../models/game-data/ability.model';
import { Alignment } from '../models/game-data/alignment.enum';
import { Condition } from '../models/game-data/condition.enum';
import { Random } from '../models/game-data/random';
import { Script } from '../models/game-data/script.model';
import { GameSetup } from '../models/game-setup/game-setup.model';
import { HexedReveal, PlacedCharacter, RevealData } from '../models/game-setup/placed-character';
import { CharacterRegistry, CHARACTERS } from './character-registry';

/** Conditions every member of a team starts with. Scoundrels always try to misdirect. */
const TEAM_DEFAULT_CONDITIONS: Record<Alignment, readonly Condition[]> = {
  [Alignment.Regular]: [],
  [Alignment.Bystander]: [],
  [Alignment.Scoundrel]: [Condition.Lying],
};

const NEGATIVE_CONDITIONS: ReadonlySet<Condition> = new Set([Condition.Lying, Condition.Confused]);

type ConditionMap = Map<string, Set<Condition>>;
/** Registrations fixed during setup, by placed-character id. */
type RegistrationMap = Map<string, readonly Registration[]>;
 /** What each character remembered during setup, by placed-character id then key. */
type MemoryMap = Map<string, Map<string, unknown>>;

/**
 * Every identity a placed character may register as to other abilities.
 * Setup overrides win (live ones while resolving, then the stored copy on the
 * reveal); otherwise it's whatever their abilities' registersAs allow.
 */
export function registrationsOf(
  pc: PlacedCharacter,
  script: Script,
  fixed?: RegistrationMap,
): Registration[] {
  const override = fixed?.get(pc.id) ?? pc.reveal?.registersAs;
  if (override?.length) return override.map((r) => ({ ...r }));
 
  const def = script.catalog.require(pc.characterId);
  const fromAbilities = script.catalog
    .abilitiesOf(def.id)
    .flatMap((a) => a.registersAs?.(def, script) ?? []);
  return fromAbilities.length ? fromAbilities : [{ characterId: def.id, team: def.team }];
}

interface SetupData {
  conditions: ConditionMap;
  registrations: RegistrationMap;
  memory: MemoryMap;
  /** Placed-character ids of everyone who held the loot, in order. */
  lootTrail: string[];
}

function makeContext(
  game: GameSetup,
  script: Script,
  self: PlacedCharacter,
  data: SetupData,
  phase: string,
): AbilityContext {
  const catalog = script.catalog;
  const definition = catalog.require(self.characterId);
  const rng = Random.from(game.seed, self.id, phase);
  const own = data.conditions.get(self.id) ?? new Set<Condition>();
 
  return {
    game,
    catalog,
    script,
    self,
    definition,
    rng,
    isMisinformed: own.has(Condition.Lying) || own.has(Condition.Confused),
    conditionsOf: (t) => data.conditions.get(t.id) ?? new Set<Condition>(),
    registrationOf: (t) => rng.pick(registrationsOf(t, script, data.registrations))!,
    possibleRegistrations: (t) => registrationsOf(t, script, data.registrations),
    recall: <T>(key: string) => data.memory.get(self.id)?.get(key) as T | undefined,
    lootTrail: data.lootTrail.map((id) => game.getById(id)!),
  };
}

/** What setup produces: everyone's conditions and who ends up with the loot. */
export interface SetupResult {
  conditions: ConditionMap;
  registrations: RegistrationMap;
  memory: MemoryMap;
  lootTrail: string[];
  lootHolderId: string | undefined;
  /** Protected placed-character id → who protected them. */
  protectedBy: Map<string, string>;
}
 
/** One ability's setup step, ready to be sorted and run. */
interface SetupStep {
  owner: PlacedCharacter;
  ability: Ability;
  priority: number;
  slot: number;
}
 
/**
 * Who holds the loot before any setup step runs: the character the author
 * marked startsWithLoot, otherwise a random in-play Scoundrel (seeded, so the
 * same puzzle always picks the same one). Start-with-loot abilities like the
 * Looter's then run on top of this.
 */
function initialLootHolder(game: GameSetup, catalog: CharacterRegistry): string | undefined {
 const authored = game.characters.find((pc) => pc.startsWithLoot);
  if (authored) return authored.id;
  const scoundrels = game.characters.filter(
    (pc) => catalog.teamOf(pc.characterId) === Alignment.Scoundrel,
  );
  return Random.from(game.seed, 'starting-loot').pick(scoundrels)?.id;
}

/**
 * Runs the setup phase:
 *   1. Everyone starts with their team's default conditions plus any the author set,
 *      and the loot starts with whoever the author marked startsWithLoot (if anyone).
 *   2. Every ability's onSetup runs in priority order (ties broken by slot number).
 * Each step sees the state left by the steps before it.
 */
export function runSetup(game: GameSetup, catalog: CharacterRegistry = CHARACTERS): SetupResult {
const script = Script.forGame(game, catalog);
 
  const conditions: ConditionMap = new Map();
  for (const pc of game.characters) {
    const team = catalog.require(pc.characterId).team;
    conditions.set(pc.id, new Set(TEAM_DEFAULT_CONDITIONS[team]));
  }
 
  const data: SetupData = { conditions, registrations: new Map(), memory: new Map(), lootTrail: [] };
  const protectedBy = new Map<string, string>();
  let lootHolderId: string | undefined;
  /** The Shield Bearer waiting to absorb the first Scoundrel ability, if any. */
  let drawingFireId: string | undefined;
 
  const giveLoot = (id: string) => {
    lootHolderId = id;
    if (data.lootTrail.at(-1) !== id) data.lootTrail.push(id);
  };
  const initial = initialLootHolder(game, catalog);
  if (initial) giveLoot(initial);
 
  const state: SetupState = {
    conditionsOf: (t) => conditions.get(t.id) ?? new Set<Condition>(),
    applyCondition: (t, condition) => {
      if (protectedBy.has(t.id) && NEGATIVE_CONDITIONS.has(condition)) return false;
      conditions.get(t.id)?.add(condition);
      return true;
    },
    get lootHolder() {
      return lootHolderId ? game.getById(lootHolderId) : undefined;
    },
    giveLoot: (t) => giveLoot(t.id),
    setRegistrations: (t, regs) => {
      data.registrations.set(t.id, regs.map((r) => ({ ...r })));
    },
    protect: (t, by) => {
      protectedBy.set(t.id, by.id);
    },
    isProtected: (t) => protectedBy.has(t.id),
    drawFire: (t) => {
      drawingFireId ??= t.id;
    },
    pickTarget: (ctx, candidates) => {
      const isScoundrel = ctx.catalog.teamOf(ctx.self.characterId) === Alignment.Scoundrel;
      if (isScoundrel && drawingFireId) {
        const shield = game.getById(drawingFireId);
        drawingFireId = undefined; // only the first Scoundrel ability is redirected
        if (shield) return shield;
      }
      return ctx.rng.pick(candidates);
    },
    remember: (owner, key, value) => {
      if (!data.memory.has(owner.id)) data.memory.set(owner.id, new Map());
      data.memory.get(owner.id)!.set(key, value);
    },
  };
 
  const steps: SetupStep[] = game.characters.flatMap((owner) =>
    catalog
      .abilitiesOf(owner.characterId)
      .filter((ability) => ability.onSetup)
      .map((ability) => ({
        owner,
        ability,
        priority: ability.setupPriority ?? SetupPriority.Conditions,
        slot: game.slotOf(owner),
      })),
  );
  steps.sort((a, b) => a.priority - b.priority || a.slot - b.slot);
 
  for (const step of steps) {
    // Context built per step so isMisinformed etc. reflect everything applied so far.
    const ctx = makeContext(game, script, step.owner, data, `setup:${step.ability.id}`);
    step.ability.onSetup!(ctx, state);
  }
 
  return { ...data, lootHolderId, protectedBy };
}
 
/**
* Runs setup, then every character's reveal abilities, and returns a copy of
 * the puzzle with each card's reveal filled in (including who has the loot).
 * Call this from the builder before exporting; the stored result is what
 * players see, so publishing never depends on re-running ability code.
 */
export function resolveGame(game: GameSetup, catalog: CharacterRegistry = CHARACTERS): GameSetup {
  const script = Script.forGame(game, catalog);
  const setup = runSetup(game, catalog);
  const reveals = new Map<string, RevealData>();
  const hexEveryOf = (pc: PlacedCharacter) =>
  catalog.abilitiesOf(pc.characterId).find((a) => a.actEvery)?.actEvery;
  const hexerInPlay = game.characters.some((pc) => hexEveryOf(pc));

  for (const pc of game.characters) {
    const ctx = makeContext(game, script, pc, setup, 'reveal');
    const draft: RevealDraft = { shownAs: ctx.definition.id, statements: [] };
 
    for (const ability of catalog.abilitiesOf(pc.characterId)) ability.onReveal?.(ctx, draft);
 
    const registersAs = setup.registrations.get(pc.id);
    const protector = setup.protectedBy.get(pc.id);

    let hexed: HexedReveal | undefined;
    if (hexerInPlay && catalog.teamOf(pc.characterId) === Alignment.Regular && !ctx.isMisinformed && !protector) {
      const hexCtx: AbilityContext = { ...makeContext(game, script, pc, setup, 'reveal-hexed'), isMisinformed: true };
      const hexDraft: RevealDraft = { shownAs: hexCtx.definition.id, statements: [] };
      for (const ability of catalog.abilitiesOf(pc.characterId)) ability.onReveal?.(hexCtx, hexDraft);
      hexed = {
        shownAs: hexDraft.shownAs,
        statements: hexDraft.statements,
        ...(hexDraft.action ? { action: hexDraft.action } : {}),
      };
    }
    const hexEvery = hexEveryOf(pc);
    reveals.set(pc.id, {
      shownAs: draft.shownAs,
      statements: draft.statements,
      conditions: [...(setup.conditions.get(pc.id) ?? [])],
      hasLoot: pc.id === setup.lootHolderId,
      ...(registersAs ? { registersAs: [...registersAs] } : {}),
      ...(setup.lootTrail.includes(pc.id) ? { heldLoot: true } : {}),
      ...(protector ? { protectedBy: protector } : {}),
      ...(draft.action ? { action: draft.action } : {}),
      ...(hexed ? { hexed } : {}),
      ...(hexEvery ? { hexEvery } : {}),
    });
  }
 
  return game.withReveals(reveals);
}