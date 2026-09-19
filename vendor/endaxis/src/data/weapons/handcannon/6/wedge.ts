import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'handcannon',
  icon: '/weapons/handcannon/wpn_handcannon_0008.webp',
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
        stat: { modifier: 'critRate' },
        target: 'self',
        value: [2.5, 4.5, 6.5, 8.5, 10.5, 12.5, 14.5, 16.5, 19.5],
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
            value: [8, 9.6, 11.2, 12.8, 14.4, 16, 17.6, 19.2, 22.4],
            duration: 15,
          },
        ],
      },
      {
        trigger: {
          kind: 'onStatusApplied',
          status: ['solidification', 'electrification', 'corrosion', 'combustion'],
          target: 'enemy',
          skillTypes: 'battleSkill',
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: ['heat', 'cryo', 'electric', 'nature'] },
            target: 'self',
            value: [16, 19.2, 22.4, 25.6, 28.8, 32, 35.2, 38.4, 44.8],
            duration: 15,
          },
        ],
      },
    ],
  },
};

export default sheet;
