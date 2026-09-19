import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'greatsword',
  icon: '/weapons/greatsword/wpn_greatsword_0013.webp',
  baseAtk: [51, 148, 250, 352, 454, 505],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'strength' },
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
        stat: { modifier: 'dmgBonus', skillTypes: ['battleSkill', 'comboSkill', 'ultimate'] },
        target: 'self',
        value: [20, 24, 28, 32, 36, 40, 44, 48, 56],
      },
    ],
    triggers: [
      {
        trigger: {
          kind: 'onStatusApplied',
          status: 'cryoInfliction',
          target: 'enemy',
          skillTypes: 'battleSkill',
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: 'cryo' },
            target: 'self',
            value: [10, 12, 14, 16, 18, 20, 22, 24, 28],
            duration: 15,
          },
        ],
      },
      {
        trigger: { kind: 'onHit', skillTypes: 'comboSkill' },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: 'cryo' },
            target: 'self',
            value: [20, 24, 28, 32, 36, 40, 44, 48, 56],
            duration: 15,
          },
        ],
      },
    ],
  },
};

export default sheet;
