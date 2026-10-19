import { Alignment } from './alignment.enum';
 
/**
 * An identity a character shows up as when *another ability* gathers
 * information about them. Does not change what their own card reveals.
 */
export interface Registration {
  characterId: string;
  team: Alignment;
}