import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 4,
  type: 'polearm',
  icon: '/weapons/polearm/wpn_polearm_0003.webp',
  baseAtk: [34, 100, 169, 238, 307, 341],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'agility' },
        target: 'self',
        value: [12, 21, 31, 40, 50, 60, 69, 79, 93],
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'atkPercent' },
        target: 'self',
        value: [3, 5.4, 7.8, 10.2, 12.6, 15, 17.4, 19.8, 23.4],
      },
    ],
  },
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'atkPercent' },
        target: 'self',
        value: [15, 18, 21, 24, 27, 30, 33, 36, 42],
        condition: { kind: 'operatorHp', compare: 'above', percent: 80 },
      },
    ],
  },
};

export default sheet;
