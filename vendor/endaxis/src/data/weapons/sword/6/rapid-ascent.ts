import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'sword',
  icon: '/weapons/sword/wpn_sword_0011.webp',
  baseAtk: [50, 145, 245, 345, 445, 495],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'main' },
        target: 'self',
        value: [17, 30, 44, 57, 71, 85, 98, 112, 132],
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'critRate' },
        target: 'self',
        value: [2.5, 4.5, 6.5, 8.5, 10.5, 12.5, 14.5, 16.5, 19.5],
      },
    ],
  },
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: {
          modifier: 'dmgBonus',
          elements: 'physical',
          skillTypes: ['battleSkill', 'ultimate'],
        },
        target: 'self',
        value: [15, 18, 21, 24, 27, 30, 33, 36, 42],
      },
      {
        kind: 'status',
        stat: {
          modifier: 'dmgBonus',
          elements: ['physical', 'heat', 'cryo', 'electric', 'nature'],
        },
        target: 'self',
        value: [35, 42, 49, 56, 63, 70, 77, 84, 98],
        condition: { kind: 'enemyStaggered' },
      },
    ],
  },
};

export default sheet;
