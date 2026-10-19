import { CharacterRegistry, CHARACTERS } from "../../game/character-registry";
import { registrationsOf } from "../../game/resolve-game";
import { GameSetup } from "../game-setup/game-setup.model";
import { PlacedCharacter } from "../game-setup/placed-character";
import { Alignment } from "./alignment.enum";
import { Script } from "./script.model";

export type Statement =
  /** "I am next to the <character>." */
  { kind: 'AdjacentTo'; characterId: string; } |
  /** "I am to <character>." */
  { kind: 'DeclareSelf'; characterId:string; } |
  /** "<character> is in play." */
  { kind: 'InPlay'; characterId:string; } |
  { kind: 'Protecting'; slot:number; } |
  { kind: 'TeamOf'; slot: number; team: Alignment; } |
  { kind: 'HadLoot'; characterId:string; } |
  /** "There is a Scoundrel among #2, #5 and #7." – true if at least one of them could register as a Scoundrel. */
  { kind: 'ScoundrelAmong'; slots: number[]; } |
  /** "The <character> is not in play." */
  { kind: 'NotInPlay'; characterId: string; };

  export function describeStatement(s: Statement, catalog: CharacterRegistry = CHARACTERS): string {
  switch (s.kind) {
    case 'AdjacentTo':
      return `I am adjacent to the ${catalog.require(s.characterId).name}.`;
    case 'DeclareSelf':
        return `I am the ${catalog.require(s.characterId).name}.`;
    case 'InPlay':
      return `The ${catalog.require(s.characterId).name} is in play.`;
    case 'Protecting':
      return `I am protecting #${s.slot}.`;
    case 'TeamOf':
      return `#${s.slot} is a ${s.team}.`;
    case 'HadLoot':
      return `The ${catalog.require(s.characterId).name} had the loot.`;
    case 'ScoundrelAmong':
      return `There is a Scoundrel among ${listSlots(s.slots)}.`;
    case 'NotInPlay':
      return `The ${catalog.require(s.characterId).name} is not in play.`;
  }
}
 
/**
 * Whether a statement is actually true. A character counts as matching if
 * they *could* register as it (so "next to the Looter" is true beside a Meddler).
 */
export function isStatementTrue(
  s: Statement,
  speaker: PlacedCharacter,
  game: GameSetup,
  catalog: CharacterRegistry = CHARACTERS,
): boolean {
  const script = Script.forGame(game, catalog);  
  switch (s.kind) {
    case 'AdjacentTo':
      return game
        .adjacentTo(speaker)
        .some((n) => registrationsOf(n, script).some((r) => r.characterId === s.characterId));
    case 'DeclareSelf':
        return speaker.characterId == s.characterId;
    case 'InPlay':{
      const couldBe = (pc: PlacedCharacter) =>
      registrationsOf(pc, script).some((r) => r.characterId === s.characterId);
      return game.characters.some(couldBe);
    }
    case 'Protecting':
      return game.getAtSlot(s.slot)?.reveal?.protectedBy === speaker.id;
    case 'TeamOf': {
      const target = game.getAtSlot(s.slot);
      const action = speaker.reveal?.action;
      if (target && s.team === Alignment.Scoundrel && action?.kind === 'ReadTeam' && action.redHerring === target.id) return true;
      return !!target && registrationsOf(target, script).some((r) => r.team === s.team);
    }
    case 'HadLoot':{
      const couldBe = (pc: PlacedCharacter) =>
      registrationsOf(pc, script).some((r) => r.characterId === s.characterId);
      return game.characters.some(
        (pc) => !!pc.reveal?.heldLoot && (pc.characterId === s.characterId || couldBe(pc)),
      );
    }
    case 'ScoundrelAmong':
      return s.slots.some((slot) => {
        const pc = game.getAtSlot(slot);
        return !!pc && registrationsOf(pc, script).some((r) => r.team === Alignment.Scoundrel);
      });
    case 'NotInPlay':
      // True as long as everyone in play can register as something else
      // (so a Meddler who *might* register as the Goblin doesn't make it false).
      return game.characters.every((pc) =>
        registrationsOf(pc, script).some((r) => r.characterId !== s.characterId),
      );
  }
}
 
/** Whether the card shows who they really are (false for disguises and confused claims). */
export const isShownAsTrue = (pc: PlacedCharacter): boolean =>
  pc.reveal?.shownAs === pc.characterId;

/** "#2, #5 and #7" */
function listSlots(slots: readonly number[]): string {
  const names = slots.map((slot) => `#${slot}`);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? '');
}