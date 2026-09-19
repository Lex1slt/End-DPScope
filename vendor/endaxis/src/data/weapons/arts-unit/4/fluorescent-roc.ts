import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 4,
  type: 'arts-unit',
  icon: '/weapons/arts-unit/wpn_artsunit_0003.webp',
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
        stat: { modifier: 'atkPercent' },
        target: 'self',
        value: [3, 5.4, 7.8, 10.2, 12.6, 15, 17.4, 19.8, 23.4],
      },
    ],
  },
  skill3: {
    triggers: [
      {
        trigger: {
          kind: 'onHit',
          skillTypes: 'battleSkill',
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'atkPercent' },
            target: 'self',
            value: [12, 14.4, 16.8, 19.2, 21.6, 24, 26.4, 28.8, 33.6],
            duration: 20,
          },
        ],
      },
    ],
  },
};

export default sheet;
