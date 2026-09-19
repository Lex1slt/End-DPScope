import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'artsIntensity' },
      target: 'self',
      value: 30,
    },
  ],
  triggers: [
    {
      trigger: { kind: 'onStatusApplied', status: 'electrification', target: 'enemy' },
      effects: [
        {
          kind: 'status',
          stat: { modifier: 'dmgBonus', elements: 'electric' },
          target: 'self',
          value: 50,
          duration: 10,
          icon: '/equipment/pulse_cryst01/item_equip_t4_suit_pulse_cryst01_edc_02.webp',
        },
      ],
    },
    {
      trigger: { kind: 'onStatusApplied', status: 'solidification', target: 'enemy' },
      effects: [
        {
          kind: 'status',
          stat: { modifier: 'dmgBonus', elements: 'cryo' },
          target: 'self',
          value: 50,
          duration: 10,
          icon: '/equipment/pulse_cryst01/item_equip_t4_suit_pulse_cryst01_edc_02.webp',
        },
      ],
    },
  ],
};

export default sheet;
