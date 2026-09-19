import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'sword',
  icon: '/weapons/sword/wpn_sword_0016.webp',
  baseAtk: [51, 146, 247, 348, 449, 500],
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
        stat: { modifier: 'dmgBonus', elements: 'physical' },
        target: 'self',
        value: [16, 19.2, 22.4, 25.6, 28.8, 32, 35.2, 38.4, 44.8],
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
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: 'physical' },
            target: 'self',
            value: [5, 6, 7, 8, 9, 10, 11, 12, 14],
            stackStrategy: 'INDEPENDENT',
            maxStacks: 5,
            duration: 30,
            icd: 0.1,
          },
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: 'physical' },
            target: 'teamExcludeSelf',
            value: [2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7],
            stackStrategy: 'INDEPENDENT',
            maxStacks: 5,
            duration: 30,
            icd: 0.1,
          },
        ],
      },
    ],
  },
};

export default sheet;
