import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'atkPercent' },
      target: 'self',
      value: 10,
    },
  ],
  triggers: [
    {
      trigger: {
        kind: 'onStatusConsumed',
        status: ['solidification', 'electrification', 'corrosion', 'combustion'],
        target: 'enemy',
      },
      effects: [
        {
          kind: 'status',
          stat: { modifier: 'dmgBonus', elements: ['cryo', 'electric', 'nature', 'heat'] },
          target: 'self',
          stacks: 'fromConsume',
          stackStrategy: 'INDEPENDENT',
          maxStacks: 3,
          value: 15,
          duration: 25,
          icon: '/equipment/expend_spell01/item_equip_t4_suit_expend_spell01_body_02.webp',
        },
      ],
    },
  ],
};

export default sheet;
