import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'staggerPercent' },
      target: 'self',
      value: 20,
    },
  ],
  triggers: [
    {
      trigger: {
        kind: 'onStatusApplied',
        status: ['lift', 'knockdown', 'crush', 'breach'],
        target: 'enemy',
      },
      effects: [
        {
          kind: 'damageHit',
          element: 'physical',
          multiplier: 250,
          hit: {
            stagger: 10,
          },
          condition: {
            kind: 'not',
            condition: {
              kind: 'operatorStatus',
              status: 'swordmancer-cooldown-tracker',
            },
          },
        },
        {
          id: 'swordmancer-cooldown-tracker',
          kind: 'status',
          target: 'self',
          duration: 15,
          condition: {
            kind: 'not',
            condition: { kind: 'operatorStatus', status: 'swordmancer-cooldown-tracker' },
          },
          ignoreTimeShift: true,
          hide: true,
        },
      ],
    },
  ],
};

export default sheet;
