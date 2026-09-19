import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 5,
  type: 'sword',
  icon: '/weapons/sword/wpn_sword_0018.webp',
  baseAtk: [42, 120, 203, 286, 369, 411],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'agility' },
        target: 'self',
        value: [16, 28, 41, 54, 67, 80, 92, 105, 124],
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'atkPercent' },
        target: 'self',
        value: [4, 7.2, 10.4, 13.6, 16.8, 20, 23.2, 26.4, 31.2],
      },
    ],
  },
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributePercent', attribute: 'sub' },
        target: 'self',
        value: [5, 6, 7, 8, 9, 10, 11, 12, 14],
      },
    ],
    triggers: [
      {
        trigger: {
          kind: 'onStatusConsumed',
          status: ['solidification', 'electrification', 'corrosion', 'combustion'],
          target: 'enemy',
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'atkPercent' },
            target: 'self',
            value: [7.5, 9, 10.5, 12, 13.5, 15, 16.5, 18, 21],
            stackStrategy: 'INDEPENDENT',
            maxStacks: 2,
            duration: 20,
          },
        ],
      },
    ],
  },
};

export default sheet;
