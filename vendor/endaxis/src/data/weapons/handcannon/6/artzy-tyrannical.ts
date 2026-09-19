import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'handcannon',
  icon: '/weapons/handcannon/wpn_handcannon_0010.webp',
  baseAtk: [51, 148, 250, 352, 454, 505],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'intellect' },
        target: 'self',
        value: [20, 36, 52, 68, 84, 100, 116, 132, 156],
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
        stat: { modifier: 'dmgBonus', elements: 'cryo' },
        target: 'self',
        value: [16, 19.2, 22.4, 25.6, 28.8, 32, 35.2, 38.4, 44.8],
      },
    ],
    triggers: [
      {
        trigger: {
          kind: 'onHit',
          skillTypes: ['battleSkill', 'comboSkill'],
        },
        effects: [
          {
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: 'cryo' },
            target: 'self',
            value: [14, 16.8, 19.6, 22.4, 25.2, 28, 30.8, 33.6, 39.2],
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
