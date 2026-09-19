import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 5,
  type: 'greatsword',
  icon: '/weapons/greatsword/wpn_greatsword_0014.webp',
  baseAtk: [42, 120, 203, 286, 369, 411],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'strength' },
        target: 'self',
        value: [16, 28, 41, 54, 67, 80, 92, 105, 124],
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'artsIntensity' },
        target: 'self',
        value: [8, 14, 20, 27, 33, 40, 46, 52, 62],
      },
    ],
  },
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'artsIntensity' },
        target: 'self',
        value: [10, 12, 14, 16, 18, 20, 22, 24, 28],
      },
    ],
    triggers: [
      {
        trigger: { kind: 'onStatusConsumed', status: 'vulnerability', target: 'enemy' },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: 'physical' },
            target: 'self',
            scaling: {
              additive: [
                {
                  key: 'vulnerability',
                  target: 'enemy',
                  coefficient: [5, 6, 7, 8, 9, 10, 11, 12, 14],
                },
              ],
            },
            duration: 20,
          },
        ],
      },
    ],
  },
};

export default sheet;
