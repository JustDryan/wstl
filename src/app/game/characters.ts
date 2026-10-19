import { Alignment } from "../models/game-data/alignment.enum";
import { CharacterDefinition } from "../models/game-data/character.model";
import { AbilityId } from "./ability-ids";
import { CharacterRegistry } from "./character-registry";

export const CharacterId = {
  Fighter: 'fighter',
  Squire: 'squire',
  Leader: 'leader',
  Clairvoyant: 'clairvoyant',
  GuildMaster: 'guild-master',
  Cleric: 'cleric',
  Paladin: 'paladin',
  ShieldBearer:'shieldbearer',
  Ledger:'ledger',
  Ranger:'ranger',
  Meddler: 'meddler',
  Sycophant: 'sycophant',
  Drunk:'drunk',
  Looter: 'looter',
  Bamboozler: 'bamboozler',
  Warlock: 'warlock',
  Mesmer: 'mesmer',
  Goblin: 'goblin',
  Hexxer: 'hexxer'
} as const;

/** Every character in the game. Add new characters here. */
export const CHARACTER_DEFINITIONS: readonly CharacterDefinition[] =
[
// REGULARS
    {
  id: CharacterId.Fighter,
  name: 'Fighter',
  team: Alignment.Regular,
  description:
    'When revealed, announces they are the Fighter. If lying or confused, announces they are a random good character.',
  abilities: [AbilityId.AnnounceIdentity],
},
{
  id: CharacterId.Squire,
  name: 'Squire',
  team: Alignment.Regular,
  description: 'When revealed, announces a random in-play character they are adjacent to.',
  abilities: [AbilityId.NameANeighbour],
},
{
  id: CharacterId.Leader,
  name: 'Leader',
  team: Alignment.Regular,
  description: 'When revealed, announces a Regular that is in play.',
  abilities: [AbilityId.KnowARegularInPlay],
},
{
    id: CharacterId.Clairvoyant,
    name: 'Clairvoyant',
    team: Alignment.Regular,
    description:
      'When revealed, pick a face-down card to learn which team it is on. One in-play Regular registers as a Scoundrel.',
    abilities: [AbilityId.ReadATeam],
  },
  {
    id: CharacterId.ShieldBearer,
    name: 'Shield Bearer',
    team: Alignment.Regular,
    description: 'The first Scoundrel ability used during setup is used on them.',
    abilities: [AbilityId.DrawScoundrelAbility],
  },
  {
    id: CharacterId.Cleric,
    name: 'Cleric',
    team: Alignment.Regular,
    description: 'Protects an in-play Regular from negative effects. When revealed, shows which slot they are protecting.',
    abilities: [AbilityId.ProtectARegular],
  },
  {
    id: CharacterId.Ledger,
    name: 'Ledger',
    team: Alignment.Regular,
    description:
      'When revealed, names the Scoundrel who had the loot during setup.',
    abilities: [AbilityId.KnowTheLootHolder],
  },
    {
    id: CharacterId.GuildMaster,
    name: 'Guild Master',
    team: Alignment.Regular,
    description: 'Starts knowing there is a Scoundrel among three slots.',
    abilities: [AbilityId.KnowAScoundrelAmongThree],
  },
  {
    id: CharacterId.Ranger,
    name: 'Ranger',
    team: Alignment.Regular,
    description: 'When revealed, names a Scoundrel that is not in play.',
    abilities: [AbilityId.KnowANotInPlayScoundrel],
  },
// BYSTANDERS
{
  id: CharacterId.Meddler,
  name: 'Meddler',
  team: Alignment.Bystander,
  description: 'May register as a Scoundrel, or any Scoundrel character.',
  abilities: [AbilityId.MayRegisterAsScoundrel],
},
{
  id: CharacterId.Sycophant,
  name: 'Sycophant',
  team: Alignment.Bystander,
  description: 'Reveals as a random Scoundrel.',
  abilities: [AbilityId.DisguiseAsInScriptBad],
},
{
  id: CharacterId.Drunk,
  name: 'Drunk',
  team: Alignment.Bystander,
  description: 'Reveals as a random Regular. They are confused.',
  abilities: [AbilityId.StartConfused, AbilityId.DisguiseAsScriptRegular],
},
// SCOUNDRELS
{
  id: CharacterId.Looter,
  name: 'Looter',
  team: Alignment.Scoundrel,
  description: 'Always starts with the loot at the beginning of the setup phase. When revealed, lies about being an in-play Regular character.',
  abilities: [AbilityId.StartWithLoot, AbilityId.DisguiseAsInPlayGood],
},
{
  id: CharacterId.Bamboozler,
  name: 'Bamboozler',
  team: Alignment.Scoundrel,
  description: 'During setup, makes a random truth-telling Regular confused. When revealed, lies about being an on script Regular character.',
  abilities: [AbilityId.ConfuseTruthfulRegular, AbilityId.DisguiseAsScriptRegular],
},
{
  id: CharacterId.Goblin,
  name: 'Goblin',
  team: Alignment.Scoundrel,
  description: 'Takes the loot at the end of the setup phase. When revealed, lies about being an on script Regular character.',
  abilities: [AbilityId.EndWithLoot, AbilityId.DisguiseAsScriptRegular],
},
{
    id: CharacterId.Mesmer,
    name: 'Mesmer',
    team: Alignment.Scoundrel,
    description:
      'During setup, picks a random in-play Regular. Registers as that Regular, and lies about being them when revealed.',
    abilities: [AbilityId.PoseAsInPlayRegular],
  },
    {
    id: CharacterId.Hexxer,
    name: 'Hexxer',
    team: Alignment.Scoundrel,
    description:
      'Every third Regular card revealed is Confused. When revealed, lies about being an on script Regular character.',
    abilities: [AbilityId.HexEveryThirdRegular, AbilityId.DisguiseAsScriptRegular],
  },
]