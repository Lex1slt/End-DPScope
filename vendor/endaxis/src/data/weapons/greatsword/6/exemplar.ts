import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'greatsword',
  icon: '/weapons/greatsword/wpn_greatsword_0004.webp',
  baseAtk: [51, 146, 247, 348, 449, 500],
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
        value: [10, 12, 14, 16, 18, 20, 22, 24, 28],
      },
    ],
    triggers: [
      {
        trigger: { kind: 'onHit', skillTypes: ['battleSkill', 'ultimate'] },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: 'physical' },
            target: 'self',
            value: [10, 12, 14, 16, 18, 20, 22, 24, 28],
            stackStrategy: 'INDEPENDENT',
            maxStacks: 3,
            duration: 30,
            icd: 0.1,
          },
        ],
      },
    ],
  },
};

export default sheet;
