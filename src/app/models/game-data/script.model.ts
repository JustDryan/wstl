import { CharacterRegistry, CHARACTERS } from "../../game/character-registry";
import { GameSetup, TeamCounts } from "../game-setup/game-setup.model";
import { Alignment } from "./alignment.enum";
import { CharacterDefinition } from "./character.model";

export class Script {
  /** Script characters in the order the puzzle lists them. */
  readonly characters: readonly CharacterDefinition[];
  private readonly ids: ReadonlySet<string>;
 
  private readonly counts: Partial<TeamCounts>;

  constructor(
    characterIds: readonly string[],
    readonly catalog: CharacterRegistry = CHARACTERS,
    counts: Partial<TeamCounts> = {}
  ) {
    this.ids = new Set(characterIds);
    this.characters = [...this.ids].map((id) => catalog.require(id));
    this.counts = { ...counts };
  }
 
  static forGame(game: GameSetup, catalog: CharacterRegistry = CHARACTERS): Script {
    const counts: Partial<TeamCounts> = {};
    for (const team of Object.values(Alignment)) {
      counts[team] = game.characters.filter((pc) => catalog.teamOf(pc.characterId) === team).length;
    }
    return new Script(game.script, catalog, counts);
  }

   inPlayCount(team: Alignment): number | undefined {
    return this.counts[team];
  }

  has(characterId: string): boolean {
    return this.ids.has(characterId);
  }
 
  byTeam(team: Alignment): CharacterDefinition[] {
    return this.characters.filter((d) => d.team === team);
  }
}
 