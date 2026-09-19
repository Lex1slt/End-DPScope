import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'sword',
  icon: '/weapons/sword/wpn_sword_0021.webp',
  baseAtk: [51, 146, 247, 348, 449, 500],
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
        stat: { modifier: 'artsIntensity' },
        target: 'self',
        value: [30, 36, 42, 48, 54, 60, 66, 72, 84],
      },
    ],
    triggers: [
      {
        trigger: {
          kind: 'onStatusApplied',
          status: ['endministrator-originium-crystals', 'solidification'],
          target: 'enemy',
        },
        effects: [
          {
            kind: 'oneTime',
            stat: { modifier: 'dmgBonus', elements: 'physical' },
            skillTypes: ['battleSkill', 'ultimate'],
            target: 'self',
            value: [36, 43.2, 50.4, 57.6, 64.8, 72, 79.2, 86.4, 100.8],
            duration: 20,
          },
        ],
      },
    ],
  },
};

export default sheet;
