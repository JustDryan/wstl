import { Ability } from "../models/game-data/ability.model";
import { announceIdentity, confuseTruthfulRegular, disguiseAsInPlayGood as disguiseAsInPlayRegular, disguiseAsInScriptBad as disguiseAsScriptScoundrel, disguiseAsScriptRegular, drawScoundrelAbility, endWithLoot, knowARegularInPlay, knowTheLootHolder, mayRegisterAsScoundrel, nameANeighbour, poseAsInPlayRegular, protectARegular, readATeam, startWithLoot, hexEveryThirdRegular, knowANotInPlayScoundrel, knowAScoundrelAmongThree, startConfused } from "./abilities";

 
/** Looks up ability implementations by their string id. */
export class AbilityRegistry {
  private readonly byId = new Map<string, Ability>();
 
  constructor(abilities: readonly Ability[]) {
    for (const ability of abilities) {
      if (this.byId.has(ability.id)) throw new Error(`Duplicate ability id "${ability.id}".`);
      this.byId.set(ability.id, ability);
    }
  }
 
  get all(): readonly Ability[] {
    return [...this.byId.values()];
  }
 
  has(id: string): boolean {
    return this.byId.has(id);
  }
 
  get(id: string): Ability | undefined {
    return this.byId.get(id);
  }
 
  require(id: string): Ability {
    const ability = this.byId.get(id);
    if (!ability) throw new Error(`Unknown ability "${id}".`);
    return ability;
  }
}
 
export const ABILITIES = new AbilityRegistry([
  announceIdentity,
  nameANeighbour,
  knowARegularInPlay,
  protectARegular,
  readATeam,
  drawScoundrelAbility,
  knowTheLootHolder,
  mayRegisterAsScoundrel,
  startWithLoot,
  endWithLoot,
  confuseTruthfulRegular,
  poseAsInPlayRegular,
  disguiseAsInPlayRegular,
  disguiseAsScriptRegular,
  disguiseAsScriptScoundrel,
  knowAScoundrelAmongThree,
  knowANotInPlayScoundrel,
  startConfused,
  hexEveryThirdRegular,
]);