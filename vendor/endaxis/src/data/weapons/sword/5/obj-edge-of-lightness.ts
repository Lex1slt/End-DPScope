import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 5,
  type: 'sword',
  icon: '/weapons/sword/wpn_sword_0019.webp',
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
        trigger: { kind: 'onSpRecovery', skillTypes: ['battleSkill', 'comboSkill', 'ultimate'] },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: ['heat', 'electric'] },
            target: 'team',
            value: [3, 3.6, 4.2, 4.8, 5.4, 6, 6.6, 7.2, 8.4],
            stackStrategy: 'INDEPENDENT',
            maxStacks: 3,
            duration: 20,
          },
        ],
      },
    ],
  },
};

export default sheet;
