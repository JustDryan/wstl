import { Alignment } from "../models/game-data/alignment.enum";

export type CardNote =
  | { kind: 'team'; team: Alignment }
  | { kind: 'character'; characterId: string };
 
/** What tapping a card in notes mode applies: a note, or clearing the card's note. */
export type NoteBrush = CardNote | { kind: 'clear' };
 
export const teamNote = (team: Alignment): CardNote => ({ kind: 'team', team });
export const characterNote = (characterId: string): CardNote => ({ kind: 'character', characterId });
export const CLEAR_BRUSH: NoteBrush = { kind: 'clear' };
 
/** Whether two notes/brushes are the same label. */
export function sameNote(a: NoteBrush | null | undefined, b: NoteBrush | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  if (a.kind === 'team' && b.kind === 'team') return a.team === b.team;
  if (a.kind === 'character' && b.kind === 'character') return a.characterId === b.characterId;
  return a.kind === 'clear' && b.kind === 'clear';
}