import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'sword',
  icon: '/weapons/sword/wpn_sword_0012.webp',
  baseAtk: [50, 144, 243, 342, 441, 490],
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
        stat: { modifier: 'atkPercent' },
        target: 'self',
        value: [5, 9, 13, 17, 21, 25, 29, 33, 39],
      },
    ],
  },
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'atkPercent' },
        target: 'self',
        value: [10, 12, 14, 16, 18, 20, 22, 24, 28],
      },
    ],
    triggers: [
      {
        trigger: {
          kind: 'onSpRecovery',
          skillTypes: ['battleSkill', 'comboSkill', 'ultimate'],
        },
        effects: [
          {
            id: 'thermite-cutter-skill3',
            kind: 'status',
            stat: { modifier: 'atkPercent' },
            target: 'team',
            value: [5, 6, 7, 8, 9, 10, 11, 12, 14],
            stackStrategy: 'INDEPENDENT',
            maxStacks: 2,
            duration: 20,
          },
        ],
      },
      {
        trigger: {
          kind: 'onStatusApplied',
          status: { modifier: 'link' },
          target: 'self',
        },
        effects: [
          {
            id: 'thermite-cutter-skill3',
            kind: 'status',
            stat: { modifier: 'atkPercent' },
            target: 'team',
            value: [5, 6, 7, 8, 9, 10, 11, 12, 14],
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
