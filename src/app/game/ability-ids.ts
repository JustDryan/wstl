export const AbilityId = {
  AnnounceIdentity: 'announce-identity',
  NameANeighbour: 'name-a-neighbour',
  KnowARegularInPlay:'know-a-regular-in-play',
  ReadATeam:'read-a-team',
  ProtectARegular:'protect-a-regular',
  DrawScoundrelAbility:'draw-scoundrel-ability',
  KnowTheLootHolder:'know-the-loot-holder',
  DisguiseAsScriptRegular: 'disguise-as-script-regular',
  StartWithLoot:'start-with-loot',
  EndWithLoot:'end-with-loot',
  MayRegisterAsScoundrel: 'may-register-as-scoundrel',
  ConfuseTruthfulRegular:'confuse-truthful-regular',
  DisguiseAsInPlayGood: 'disguise-as-in-play-good',
  DisguiseAsInScriptBad:'disguise-as-in-script-bad',
  PoseAsInPlayRegular: 'pose-as-in-play-regular',
  KnowAScoundrelAmongThree: 'know-a-scoundrel-among-three',
  KnowANotInPlayScoundrel: 'know-a-not-in-play-scoundrel',
  StartConfused: 'start-confused',
  HexEveryThirdRegular: 'hex-every-third-regular',
} as const;

export type AbilityId = (typeof AbilityId)[keyof typeof AbilityId];