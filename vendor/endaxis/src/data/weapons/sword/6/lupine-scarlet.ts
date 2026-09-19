import type { WeaponSheet } from '../../../types';

const sheet: WeaponSheet = {
  rarity: 6,
  type: 'sword',
  icon: '/weapons/sword/wpn_sword_0022.webp',
  baseAtk: [51, 148, 250, 352, 454, 505],
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'agility' },
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
        stat: { modifier: 'atkPercent' },
        target: 'self',
        value: [16, 19.2, 22.4, 25.6, 28.8, 32, 35.2, 38.4, 44.8],
      },
    ],
    triggers: [
      {
        trigger: { kind: 'onHit' },
        effects: [
          {
            id: 'wolven-blood',
            name: 'wolvenBlood',
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: ['physical', 'heat'] },
            target: 'self',
            value: [1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.8],
            maxStacks: 16,
            duration: 999,
            condition: {
              kind: 'not',
              condition: {
                kind: 'operatorStatus',
                status: 'wolven-blood-extra',
              },
            },
          },
        ],
      },
      {
        trigger: {
          kind: 'onStatusApplied',
          status: 'wolven-blood',
          target: 'self',
        },
        effects: [
          {
            id: 'wolven-blood-extra',
            kind: 'status',
            stat: { modifier: 'dmgBonus', elements: ['physical', 'heat'] },
            target: 'self',
            value: [24, 28.8, 33.6, 38.4, 43.2, 48, 52.8, 57.6, 67.2],
            duration: 20,
            condition: {
              kind: 'operatorStatus',
              status: 'wolven-blood',
              stacks: { compare: 'exact', count: 16 },
            },
          },
        ],
      },
      {
        trigger: {
          kind: 'onStatusExpire',
          status: 'wolven-blood-extra',
          target: 'self',
        },
        effects: [
          {
            kind: 'consume',
            operatorStatus: 'wolven-blood',
          },
        ],
      },
    ],
  },
};

export default sheet;
