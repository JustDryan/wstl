import { TEAMS, RED_HERRING, PROTECTING, HOLDER } from "./ability-keys";
import { Ability, AbilityContext, AbilityKind, RevealDraft, SetupPriority } from "../models/game-data/ability.model";
import { Alignment } from "../models/game-data/alignment.enum";
import { Condition } from "../models/game-data/condition.enum";
import { AbilityId } from "./ability-ids";
import { Random } from "../models/game-data/random";

// REGULAR ABILITIES

// FIGHER
export const announceIdentity: Ability = {
  id: AbilityId.AnnounceIdentity,
  name: 'Announce identity',
  description:
    'When revealed, announces who they are. If lying or confused, claims to be a random other good character.',
  kind: AbilityKind.Information,
 
  onReveal(ctx, reveal) {
    if (!ctx.isMisinformed){
        reveal.statements.push({
        kind: 'DeclareSelf',
        characterId: ctx.self.characterId,
        });
        return;
    }
    const options = ctx.script
      .byTeam(Alignment.Regular)
      .filter((d) => d.id !== ctx.definition.id);
    const pick = ctx.rng.pick(options);
    if (pick){
        reveal.shownAs = pick.id;
        reveal.statements.push({
        kind: 'DeclareSelf',
        characterId: pick.id,
        });
    }
  },
};
 

// SQUIRE
export const nameANeighbour: Ability = {
  id: AbilityId.NameANeighbour,
  name: 'Name a neighbour',
  description: 'When revealed, announces a random in-play character they are adjacent to.',
  kind: AbilityKind.Information,
 
  onReveal(ctx, reveal) {
    const neighbours = ctx.game.adjacentTo(ctx.self);
 
    if (!ctx.isMisinformed) {
      const target = ctx.rng.pick(neighbours);
      if (target) {
        reveal.statements.push({
          kind: 'AdjacentTo',
          characterId: ctx.registrationOf(target).characterId,
        });
      }
      return;
    }
 
    // Anything a neighbour could register as would make the claim true – exclude it.
    const trueIds = new Set(
      neighbours.flatMap((n) => ctx.possibleRegistrations(n).map((r) => r.characterId)),
    );
    const falseIds = new Set<string>();
    for (const c of ctx.game.characters) {
      if (c.id === ctx.self.id || neighbours.includes(c)) continue;
      for (const r of ctx.possibleRegistrations(c)) {
        if (!trueIds.has(r.characterId)) falseIds.add(r.characterId);
      }
    }
    const claim = ctx.rng.pick([...falseIds]);
    if (claim) reveal.statements.push({ kind: 'AdjacentTo', characterId: claim });
    // If no false claim is possible, they say nothing.
  },
};

// LEADER
export const knowARegularInPlay: Ability = {
  id: AbilityId.KnowARegularInPlay,
  name: 'Second sight',
  description: 'Starts knowing a specific Regular that is in play.',
  kind: AbilityKind.Information,
 
  onReveal(ctx, reveal) {
    if (!ctx.isMisinformed) {
      // Every Regular identity another in-play character could register as.
      const options = ctx.game.characters
        .filter((c) => c.id !== ctx.self.id)
        .flatMap((c) => ctx.possibleRegistrations(c))
        .filter((r) => r.team === Alignment.Regular)
        .map((r) => r.characterId);
 
      const pick = ctx.rng.pick([...new Set(options)]);
      if (pick) reveal.statements.push({ kind: 'InPlay', characterId: pick });
      return;
    }
 
    // Anything someone in play (including themselves) could register as would be true – exclude it.
    const inPlayIds = new Set(
      ctx.game.characters.flatMap((c) => ctx.possibleRegistrations(c).map((r) => r.characterId)),
    );
    const falseOptions = ctx.script
      .byTeam(Alignment.Regular)
      .map((d) => d.id)
      .filter((id) => !inPlayIds.has(id));
 
    const claim = ctx.rng.pick(falseOptions);
    if (claim) reveal.statements.push({ kind: 'InPlay', characterId: claim });
  },
};

//CLERIC
export const protectARegular: Ability = {
  id: AbilityId.ProtectARegular,
  name: 'Sanctuary',
  description: 'Protects an in-play Regular from negative effects, before the Scoundrels act.',
  kind: AbilityKind.Information,
  setupPriority: SetupPriority.Protection,
 
  onSetup(ctx, setup) {
    const regulars = ctx.game.characters.filter(
      (c) => c.id !== ctx.self.id && ctx.catalog.teamOf(c.characterId) === Alignment.Regular,
    );
    const target = ctx.rng.pick(regulars);
    if (!target) return;
    setup.remember(ctx.self, PROTECTING, target.id);
    if (!ctx.isMisinformed) setup.protect(target, ctx.self);
  },
 
  onReveal(ctx, reveal) {
    if (!ctx.isMisinformed) {
      const target = ctx.game.getById(ctx.recall<string>(PROTECTING) ?? '');
      if (target) reveal.statements.push({ kind: 'Protecting', slot: ctx.game.slotOf(target) });
      return;
    }
 
    // Name anyone but the one they picked: if the protection worked, naming
    // them would be true; if it didn't, any slot is false. A Scoundrel posing
    // as a Cleric has no pick, so any other card will do.
    const picked = ctx.recall<string>(PROTECTING);
    const others = ctx.game.characters.filter((c) => c.id !== ctx.self.id && c.id !== picked);
    const claim = ctx.rng.pick(others);
    if (claim) reveal.statements.push({ kind: 'Protecting', slot: ctx.game.slotOf(claim) });
  },
};

//CLAIRVOYANT
export const readATeam: Ability = {
  id: AbilityId.ReadATeam,
  name: 'Second sight',
  description: 'When revealed, pick a face-down card to learn its team.',
  kind: AbilityKind.Action,
 
  onSetup(ctx, setup) {
    const regulars = ctx.game.characters.filter(
      (c) => c.id !== ctx.self.id && ctx.catalog.teamOf(c.characterId) === Alignment.Regular,
    );
    const herring = ctx.rng.pick(regulars);
    if (herring) setup.remember(ctx.self, RED_HERRING, herring.id);
  },
 
  onReveal(ctx, reveal) {
    // Only the real Clairvoyant has a herring; a Scoundrel posing as one doesn't.
    const redHerring = ctx.recall<string>(RED_HERRING);
 
    /** Every team this Clairvoyant could truthfully say for the card. */
    const truthfulTeams = (id: string) => {
      const target = ctx.game.getById(id)!;
      const teams = new Set(ctx.possibleRegistrations(target).map((r) => r.team));
      if (id === redHerring) teams.add(Alignment.Scoundrel);
      return teams;
    };
 
    const answers: Record<string, Alignment> = {};
    for (const target of ctx.game.characters) {
      if (target.id === ctx.self.id) continue;
      if (!ctx.isMisinformed) {
        answers[target.id] =
          target.id === redHerring ? Alignment.Scoundrel : ctx.registrationOf(target).team;
        continue;
      }
      const possible = truthfulTeams(target.id);
      const lie = ctx.rng.pick(TEAMS.filter((t) => !possible.has(t)));
      if (lie) answers[target.id] = lie;
    }
    reveal.action = { kind: 'ReadTeam', answers, ...(redHerring ? { redHerring } : {}) };
  },
};

//GUILD MASTER
export const knowAScoundrelAmongThree: Ability = {
  id: AbilityId.KnowAScoundrelAmongThree,
  name: 'Guild records',
  description: 'Starts knowing there is a Scoundrel among three slots.',
  kind: AbilityKind.Information,

  onReveal(ctx, reveal) {
    const others = ctx.game.characters.filter((c) => c.id !== ctx.self.id);
    const count = Math.min(3, others.length);
    const couldBeScoundrel = (c: (typeof others)[number]) =>
      ctx.possibleRegistrations(c).some((r) => r.team === Alignment.Scoundrel);

    let picks: typeof others;
    if (!ctx.isMisinformed) {
      // One character that registers as a Scoundrel, plus random others.
      const scoundrel = ctx.rng.pick(
        others.filter((c) => ctx.registrationOf(c).team === Alignment.Scoundrel),
      );
      if (!scoundrel) return;
      const rest = shuffle(others.filter((c) => c !== scoundrel), ctx.rng).slice(0, count - 1);
      picks = [scoundrel, ...rest];
    } else {
      // Three characters none of whom could register as a Scoundrel, so the claim is false.
      const innocent = others.filter((c) => !couldBeScoundrel(c));
      if (innocent.length < count) return;
      picks = shuffle(innocent, ctx.rng).slice(0, count);
    }

    const slots = picks.map((c) => ctx.game.slotOf(c)).sort((a, b) => a - b);
    reveal.statements.push({ kind: 'ScoundrelAmong', slots });
  },
};

//RANGER
export const knowANotInPlayScoundrel: Ability = {
  id: AbilityId.KnowANotInPlayScoundrel,
  name: 'Tracker',
  description: 'When revealed, names a Scoundrel from the script that is not in play.',
  kind: AbilityKind.Information,

  onReveal(ctx, reveal) {
    const scriptScoundrels = ctx.script.byTeam(Alignment.Scoundrel).map((d) => d.id);

    if (!ctx.isMisinformed) {
      // What the Ranger sees everyone as – a Meddler seen as the Goblin counts as the Goblin.
      const seen = new Set(ctx.game.characters.map((c) => ctx.registrationOf(c).characterId));
      const claim = ctx.rng.pick(scriptScoundrels.filter((id) => !seen.has(id)));
      if (claim) reveal.statements.push({ kind: 'NotInPlay', characterId: claim });
      return;
    }

    // A Scoundrel someone can only register as, so "not in play" is definitely false.
    const definitelyInPlay = scriptScoundrels.filter((id) =>
      ctx.game.characters.some((c) => ctx.possibleRegistrations(c).every((r) => r.characterId === id)),
    );
    const claim = ctx.rng.pick(definitelyInPlay);
    if (claim) reveal.statements.push({ kind: 'NotInPlay', characterId: claim });
  },
};

//SHIELD BEARER
export const drawScoundrelAbility: Ability = {
  id: AbilityId.DrawScoundrelAbility,
  name: 'Draw fire',
  description: 'The first Scoundrel ability used during setup is used on them.',
  kind: AbilityKind.Passive,
  setupPriority: SetupPriority.Protection,
 
  onSetup(ctx, setup) {
    if (!ctx.isMisinformed) setup.drawFire(ctx.self);
  },
};

//LEDGER
export const knowTheLootHolder: Ability = {
  id: AbilityId.KnowTheLootHolder,
  name: 'Accounts',
  description: 'Knows which Scoundrel had the loot during setup.',
  kind: AbilityKind.Information,
  setupPriority: SetupPriority.Observe,

  onSetup(ctx, setup) {
    setup.remember(ctx.self, HOLDER, setup.lootHolder?.id);
  },

  onReveal(ctx, reveal) {
    if (!ctx.isMisinformed) {
      const holder = ctx.game.getById(ctx.recall<string>(HOLDER) ?? '');
      if (holder) {
        reveal.statements.push({ kind: 'HadLoot', characterId: holder.characterId });
      }
      return;
    }

    // Anyone who held it at any point would make the claim true – exclude them.
    const trueIds = new Set(
      ctx.lootTrail.flatMap((pc) => [pc.characterId, ...ctx.possibleRegistrations(pc).map((r) => r.characterId)]),
    );
    const falseOptions = ctx.script
      .byTeam(Alignment.Scoundrel)
      .map((d) => d.id)
      .filter((id) => !trueIds.has(id));
    const claim = ctx.rng.pick(falseOptions);
    if (claim) reveal.statements.push({ kind: 'HadLoot', characterId: claim });
  },
};

//BYSTANDER ABILITIES

//MEDDLER
export const mayRegisterAsScoundrel: Ability = {
  id: AbilityId.MayRegisterAsScoundrel,
  name: 'Shifty',
  description: 'May register as a Scoundrel, or as any Scoundrel character.',
  kind: AbilityKind.Passive,
 
  registersAs(owner, script) {
    return [
      { characterId: owner.id, team: owner.team },
      { characterId: owner.id, team: Alignment.Scoundrel },
      ...script
        .byTeam(Alignment.Scoundrel)
        .map((d) => ({ characterId: d.id, team: Alignment.Scoundrel })),
    ];
  },
};

//DRUNK
export const startConfused: Ability = {
  id: AbilityId.StartConfused,
  name: 'Drunk',
  description: 'Starts the game Confused.',
  kind: AbilityKind.Passive,
  // Before anything reads conditions.
  setupPriority: SetupPriority.Protection,

  onSetup(ctx, setup) {
    setup.applyCondition(ctx.self, Condition.Confused);
  },
};

//SCOUNDREL ABILITIES

//HEXXER
export const hexEveryThirdRegular: Ability = {
  id: AbilityId.HexEveryThirdRegular,
  name: 'Hex',
  description: 'Every third Regular card revealed is Confused.',
  kind: AbilityKind.Passive,
  // Read by resolveGame (which works out a confused version of every Regular's
  // reveal) and by the GameService (which counts Regulars as they're flipped).
  actEvery: 3,
};

//TAKE LOOT
export const startWithLoot: Ability = {
  id: AbilityId.StartWithLoot,
  name: 'Sticky fingers',
  description: 'Always starts with the loot.',
  kind: AbilityKind.Passive,
  setupPriority: SetupPriority.StartingLoot,
 
  onSetup(ctx, setup) {
    const claimants = ctx.game.characters.filter((pc) =>
      ctx.catalog.abilitiesOf(pc.characterId).some((a) => a.id === AbilityId.StartWithLoot),
    );
    if (claimants.length === 1) setup.giveLoot(ctx.self);
  },
};

export const endWithLoot: Ability = {
  id: AbilityId.EndWithLoot,
  name: 'Last grab',
  description: 'Always ends setup holding the loot.',
  kind: AbilityKind.Passive,
  setupPriority: SetupPriority.Final,
 
  onSetup(ctx, setup) {
    setup.giveLoot(ctx.self);
  },
};

//BAMBOOZLER
export const confuseTruthfulRegular: Ability = {
  id: AbilityId.ConfuseTruthfulRegular,
  name: 'Bamboozle',
  description: 'During setup, makes a random truth-telling Regular confused.',
  kind: AbilityKind.Passive,
  setupPriority: SetupPriority.Conditions,


  onSetup(ctx, setup) {
    const truthfulRegulars = ctx.game.characters.filter((c) => {
      if (c.id === ctx.self.id) return false;
      if (ctx.catalog.teamOf(c.characterId) !== Alignment.Regular) return false;
      const conditions = setup.conditionsOf(c);
      return !conditions.has(Condition.Lying) && !conditions.has(Condition.Confused);
    });
 
    const target = ctx.rng.pick(truthfulRegulars);
    if (target) setup.applyCondition(target, Condition.Confused);
  },
};

export const poseAsInPlayRegular: Ability = {
  id: AbilityId.PoseAsInPlayRegular,
  name: 'Mesmerise',
  description: 'Registers as a random in-play Regular, and claims to be them when revealed.',
  kind: AbilityKind.Passive,
  setupPriority: SetupPriority.Registrations,
 
  onSetup(ctx, setup) {
    const inPlay = new Set(
      ctx.game.characters
        .filter((c) => c.id !== ctx.self.id)
        .filter((c) => ctx.catalog.teamOf(c.characterId) === Alignment.Regular)
        .map((c) => c.characterId),
    );
    const pool = inPlay.size ? [...inPlay] : ctx.script.byTeam(Alignment.Regular).map((d) => d.id);
 
    const pick = ctx.rng.pick(pool);
    if (pick) setup.setRegistrations(ctx.self, [{ characterId: pick, team: Alignment.Regular }]);
  },
 
  onReveal(ctx, reveal) {
    const posingAs = ctx.possibleRegistrations(ctx.self)[0];
    if (!posingAs || posingAs.characterId === ctx.definition.id) return;
    reveal.shownAs = posingAs.characterId;
    actOutRevealAs(ctx, reveal, posingAs.characterId);
  },
};

//GENERAL DISGUISE

export const disguiseAsInPlayGood: Ability = {
  id: AbilityId.DisguiseAsInPlayGood,
  name: 'Disguise',
  description: 'When revealed, claims to be another good character that is in play.',
  kind: AbilityKind.Passive,
 
  onReveal(ctx, reveal) {
    const inPlayGood = new Set<string>();
    for (const c of ctx.game.characters) {
      if (c.id === ctx.self.id) continue;
      if (ctx.catalog.teamOf(c.characterId) === Alignment.Regular) inPlayGood.add(c.characterId);
    }
 
    const pool = inPlayGood.size
      ? [...inPlayGood]
      : ctx.script.byTeam(Alignment.Regular).map((d) => d.id);
 
    const pick = ctx.rng.pick(pool);
    if (!pick) return;
    reveal.shownAs = pick;
    actOutRevealAs(ctx, reveal, pick);
  },
};

export const disguiseAsScriptRegular: Ability = {
     id: AbilityId.DisguiseAsScriptRegular,
     name: 'Bluff',
     description: 'When revealed, claims to be a Regular from the script who is not in play.',
     kind: AbilityKind.Passive,

     onReveal(ctx, reveal) {
       const inPlay = new Set(ctx.game.characters.map((c) => c.characterId));
       const scriptRegulars = ctx.script.byTeam(Alignment.Regular).map((d) => d.id);
       const notInPlay = scriptRegulars.filter((id) => !inPlay.has(id));
       const pool = notInPlay.length ? notInPlay : scriptRegulars;
       if (!pool.length) return;

       // Same shuffle for every bluffer (seeded by the puzzle, not the character),
       // then each takes the next one in slot order, so no two bluff the same Regular.
       const shuffled = shuffle(pool, Random.from(ctx.game.seed, 'script-bluffs'));
       const bluffers = ctx.game.characters
         .filter((c) => ctx.catalog.abilitiesOf(c.characterId).some((a) => a.id === AbilityId.DisguiseAsScriptRegular))
         .sort((a, b) => ctx.game.slotOf(a) - ctx.game.slotOf(b));
       const index = Math.max(0, bluffers.findIndex((c) => c.id === ctx.self.id));
       const pick = shuffled[index % shuffled.length];

       reveal.shownAs = pick;
       actOutRevealAs(ctx, reveal, pick);
     },
   };

   function shuffle<T>(items: readonly T[], rng: Random): T[] {
     const out = [...items];
     for (let i = out.length - 1; i > 0; i--) {
       const j = rng.int(i + 1);
       [out[i], out[j]] = [out[j], out[i]];
     }
     return out;
   };

export const disguiseAsInScriptBad: Ability = {
  id: AbilityId.DisguiseAsInScriptBad,
  name: 'Disguise',
  description: 'When revealed, claims to a Scoundrel on the script.',
  kind: AbilityKind.Passive,
 
  onReveal(ctx, reveal) {
    const onScriptBad = new Set<string>();
    for (const c of ctx.game.script) {
      if (c === ctx.self.id) continue;
      if (ctx.catalog.teamOf(c) === Alignment.Scoundrel) onScriptBad.add(c);
    }
 
    const pool = onScriptBad.size
      ? [...onScriptBad]
      : ctx.script.byTeam(Alignment.Scoundrel).map((d) => d.id);
 
    const pick = ctx.rng.pick(pool);
    if (!pick) return;
    reveal.shownAs = pick;
    actOutRevealAs(ctx, reveal, pick);
  },
};

function actOutRevealAs(ctx: AbilityContext, reveal: RevealDraft, characterId: string): void {
  const disguise = ctx.catalog.require(characterId);
  const borrowedCtx: AbilityContext = { ...ctx, definition: disguise, isMisinformed: true };
  const borrowedDraft: RevealDraft = { shownAs: characterId, statements: [] };
 
const disguises: string[] = [
    AbilityId.DisguiseAsInPlayGood,
    AbilityId.DisguiseAsScriptRegular,
    AbilityId.DisguiseAsInScriptBad,
    AbilityId.PoseAsInPlayRegular,
  ];

  for (const ability of ctx.catalog.abilitiesOf(characterId)) {
    // Never chain into another disguise.
    if (disguises.includes(ability.id)) continue;
    ability.onReveal?.(borrowedCtx, borrowedDraft);
  }
 
  reveal.statements.push(...borrowedDraft.statements);
  if (borrowedDraft.action) reveal.action = borrowedDraft.action;
}
 
 