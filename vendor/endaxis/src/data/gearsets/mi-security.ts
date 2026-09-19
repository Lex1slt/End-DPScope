import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'critRate' },
      target: 'self',
      value: 5,
    },
    {
      kind: 'status',
      stat: { modifier: 'critRate' },
      target: 'self',
      value: 5,
      condition: {
        kind: 'operatorStatus',
        status: 'mi-security-stack',
        stacks: { compare: 'exact', count: 5 },
      },
      icon: '/equipment/criti01/item_equip_t4_suit_criti01_edc_03.webp',
    },
  ],
  triggers: [
    {
      trigger: { kind: 'onHit' },
      effects: [
        {
          id: 'mi-security-stack',
          kind: 'status',
          stat: { modifier: 'atkPercent' },
          target: 'self',
          value: 5,
          maxStacks: 5,
          duration: 5,
          icon: '/equipment/criti01/item_equip_t4_suit_criti01_edc_03.webp',
        },
      ],
    },
  ],
};

export default sheet;
