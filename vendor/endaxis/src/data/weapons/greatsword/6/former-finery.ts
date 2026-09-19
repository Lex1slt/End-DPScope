import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'greatsword',
  icon: '/weapons/greatsword/wpn_greatsword_0006.webp',
  baseAtk: [50, 145, 245, 345, 445, 495],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'will' },
        target: 'self',
        value: [20, 36, 52, 68, 84, 100, 116, 132, 156],
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'hpPercent' },
        target: 'self',
        value: [10, 18, 26, 34, 42, 50, 58, 66, 78],
      },
    ],
  },
  skill3: {},
};

export default sheet;
