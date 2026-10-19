import { Alignment } from './alignment.enum';

/**
 * Something the player does with a card after flipping it. The answers are
 * worked out when the puzzle is resolved, so play never re-runs ability code.
 */
export type RevealAction =
  /**
   * Pick a face-down card and learn its team. `answers` holds what the
   * character would say for each placed-character id (false if they're lying
   * or confused).
   */
  {
    kind: 'ReadTeam';
    answers: Record<string, Alignment>;
    /**
     * Placed-character id of this character's red herring: a Regular who
     * looks like a Scoundrel to *this* character only. Other abilities see
     * them as normal.
     */
    redHerring?: string;
  };
 
export const copyRevealAction = (a: RevealAction): RevealAction => ({
  kind: a.kind,
  answers: { ...a.answers },
  ...(a.redHerring ? { redHerring: a.redHerring } : {}),
});