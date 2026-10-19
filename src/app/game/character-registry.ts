import { Ability } from "../models/game-data/ability.model";
import { Alignment } from "../models/game-data/alignment.enum";
import { CharacterDefinition } from "../models/game-data/character.model";
import { ABILITIES, AbilityRegistry } from "./ability-registry";
import { CHARACTER_DEFINITIONS } from "./characters";

export class CharacterRegistry {
  private readonly byId = new Map<string, CharacterDefinition>();
  private readonly abilityCache = new Map<string, readonly Ability[]>();

  constructor(definitions: readonly CharacterDefinition[],
    readonly abilities: AbilityRegistry
  ) {
    for (const def of definitions) {
      if (this.byId.has(def.id)) throw new Error(`Duplicate character id "${def.id}".`);
      for (const abilityId of def.abilities) {
        if (!abilities.has(abilityId)) {
          throw new Error(`Character "${def.id}" uses unknown ability "${abilityId}".`);
        }
      }
      this.byId.set(def.id, def);
    }
  }

  get all(): readonly CharacterDefinition[] {
    return [...this.byId.values()];
  }

  get(id: string): CharacterDefinition | undefined {
    return this.byId.get(id);
  }

  require(id: string): CharacterDefinition {
    const def = this.byId.get(id);
    if (!def) throw new Error(`Unknown character "${id}".`);
    return def;
  }

  byTeam(team: Alignment): CharacterDefinition[] {
    return this.all.filter((d) => d.team === team);
  }
  
  abilitiesOf(characterId: string): readonly Ability[] {
    let list = this.abilityCache.get(characterId);
    if (!list) {
      list = this.require(characterId).abilities.map((id) => this.abilities.require(id));
      this.abilityCache.set(characterId, list);
    }
    return list;
  }

  /** Arrow function so it can be passed straight to GameSetup.validate. */
  readonly teamOf = (id: string): Alignment | undefined => this.byId.get(id)?.team;
}

export const CHARACTERS = new CharacterRegistry(CHARACTER_DEFINITIONS, ABILITIES);