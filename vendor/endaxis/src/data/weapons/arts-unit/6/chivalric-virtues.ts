import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'arts-unit',
  icon: '/weapons/arts-unit/wpn_artsunit_0008.webp',
  baseAtk: [49, 142, 240, 338, 436, 485],
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
  skill3: {
    triggers: [
      {
        trigger: {
          kind: 'onStatusApplied',
          status: { modifier: 'heal' },
          target: 'self',
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'atkPercent' },
            target: 'team',
            value: [9, 10.8, 12.6, 14.4, 16.2, 18, 19.8, 21.6, 25.2],
            duration: 15,
          },
        ],
      },
    ],
  },
};

export default sheet;
