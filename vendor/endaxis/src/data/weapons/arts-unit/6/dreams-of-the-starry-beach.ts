import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'arts-unit',
  icon: '/weapons/arts-unit/wpn_artsunit_0013.webp',
  baseAtk: [50, 145, 245, 345, 445, 495],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'intellect' },
        target: 'self',
        value: [20, 36, 52, 68, 84, 100, 116, 132, 156],
      },
    ],
  },
  skill2: {},
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributePercent', attribute: 'sub' },
        target: 'self',
        value: [16, 19.2, 22.4, 25.6, 28.8, 32, 35.2, 38.4, 44.8],
      },
    ],
    triggers: [
      {
        trigger: {
          kind: 'onStatusConsumed',
          status: 'corrosion',
          target: 'enemy',
        },
        effects: [
          {
            kind: 'status',
            stat: {
              modifier: 'increasedDmgTaken',
              elements: ['cryo', 'electric', 'heat', 'nature'],
            },
            value: [10, 12, 14, 16, 18, 20, 22, 24, 28],
            target: 'enemy',
            duration: 25,
          },
        ],
      },
    ],
  },
};

export default sheet;
