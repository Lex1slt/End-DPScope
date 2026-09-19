import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'handcannon',
  icon: '/weapons/handcannon/wpn_handcannon_0011.webp',
  baseAtk: [51, 148, 250, 352, 454, 505],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'agility' },
        target: 'self',
        value: [20, 36, 52, 68, 84, 100, 116, 132, 156],
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'atkPercent' },
        target: 'self',
        value: [5, 9, 13, 17, 21, 25, 29, 33, 39],
      },
    ],
  },
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'dmgBonus', elements: 'cryo' },
        target: 'self',
        value: [16, 19.2, 22.4, 25.6, 28.8, 32, 35.2, 38.4, 44.8],
      },
    ],
    triggers: [
      {
        trigger: {
          kind: 'onStatusApplied',
          status: 'cryoInfliction',
          target: 'enemy',
          skillTypes: ['battleSkill', 'ultimate'],
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: 'cryo' },
            target: 'self',
            value: [20, 24, 28, 32, 36, 40, 44, 48, 56],
            duration: 20,
          },
        ],
      },
      {
        trigger: {
          kind: 'onStatusApplied',
          status: { modifier: 'susceptibility' },
          target: 'enemy',
          skillTypes: ['battleSkill', 'ultimate'],
        },
        effects: [
          {
            kind: 'status',
            stat: {
              modifier: 'increasedDmgTaken',
              elements: ['cryo', 'electric', 'nature', 'heat'],
            },
            target: 'self',
            value: [6, 7.2, 8.4, 9.6, 10.8, 12, 13.2, 14.4, 16.8],
            duration: 20,
          },
        ],
      },
    ],
  },
};

export default sheet;
