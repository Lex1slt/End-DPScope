import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'polearm',
  icon: '/weapons/polearm/wpn_polearm_0011.webp',
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
        stat: { modifier: 'dmgBonus', elements: ['heat', 'cryo', 'electric', 'nature'] },
        target: 'self',
        value: [12, 14.4, 16.8, 19.2, 21.6, 24, 26.4, 28.8, 33.6],
      },
    ],
    triggers: [
      {
        trigger: {
          kind: 'onActionStart',
          skillTypes: 'battleSkill',
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: ['heat', 'cryo', 'electric', 'nature'] },
            target: 'self',
            value: [12, 14.4, 16.8, 19.2, 21.6, 24, 26.4, 28.8, 33.6],
            duration: 15,
          },
        ],
      },
      {
        trigger: {
          kind: 'onActionStart',
          skillTypes: 'comboSkill',
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: ['heat', 'cryo', 'electric', 'nature'] },
            target: 'self',
            value: [12, 14.4, 16.8, 19.2, 21.6, 24, 26.4, 28.8, 33.6],
            duration: 15,
          },
        ],
      },
    ],
  },
};

export default sheet;
