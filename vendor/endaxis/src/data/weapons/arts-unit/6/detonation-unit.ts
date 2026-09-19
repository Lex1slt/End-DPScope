import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'arts-unit',
  icon: '/weapons/arts-unit/wpn_artsunit_0010.webp',
  baseAtk: [50, 144, 243, 342, 441, 490],
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
        stat: { modifier: 'artsIntensity' },
        target: 'self',
        value: [10, 18, 26, 34, 42, 50, 58, 66, 78],
      },
    ],
  },
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributePercent', attribute: 'sub' },
        target: 'self',
        value: [10, 12, 14, 16, 18, 20, 22, 24, 28],
      },
    ],
    triggers: [
      {
        trigger: {
          kind: 'onStatusApplied',
          status: ['cryoBurst', 'electricBurst', 'natureBurst', 'heatBurst'],
          target: 'enemy',
        },
        effects: [
          {
            kind: 'status',
            stat: {
              modifier: 'increasedDmgTaken',
              elements: ['heat', 'cryo', 'electric', 'nature'],
            },
            value: [9, 10.8, 12.6, 14.4, 16.2, 18, 19.8, 21.6, 25.2],
            target: 'enemy',
            duration: 15,
          },
        ],
      },
    ],
  },
};

export default sheet;
