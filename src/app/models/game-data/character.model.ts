import { Ability } from "./ability.model";
import { Alignment } from "./alignment.enum";

export interface CharacterDefinition {
  id: string;
  name: string;
  team: Alignment;
  /** Rules text shown on the card / in the builder. */
  description: string;
  abilities: readonly string[];
  portrait?: string;
}