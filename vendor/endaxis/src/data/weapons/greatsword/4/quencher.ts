import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 4,
  type: 'greatsword',
  icon: '/weapons/greatsword/wpn_greatsword_0009.webp',
  baseAtk: [34, 100, 169, 238, 307, 341],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'will' },
        target: 'self',
        value: [12, 21, 31, 40, 50, 60, 69, 79, 93],
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'hpPercent' },
        target: 'self',
        value: [6, 10.8, 15.6, 20.4, 25.2, 30, 34.8, 39.6, 46.8],
      },
    ],
  },
  skill3: {
    triggers: [
      {
        trigger: {
          kind: 'onFinalStrike',
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'atkPercent' },
            target: 'self',
            value: [12, 14.4, 16.8, 19.2, 21.6, 24, 26.4, 28.8, 33.6],
            duration: 10,
          },
        ],
      },
    ],
  },
};

export default sheet;
