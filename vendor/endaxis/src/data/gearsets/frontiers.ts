import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'cooldownReductionPercent', skillTypes: 'comboSkill' },
      target: 'self',
      value: 15,
    },
  ],
  triggers: [
    {
      trigger: { kind: 'onSpRecovery', skillTypes: ['battleSkill', 'comboSkill', 'ultimate'] },
      effects: [
        {
          kind: 'status',
          stat: {
            modifier: 'dmgBonus',
            elements: ['physical', 'heat', 'cryo', 'electric', 'nature'],
          },
          target: 'team',
          value: 16,
          duration: 15,
          icon: '/equipment/atb01/item_equip_t4_suit_atb01_edc_04.webp',
        },
      ],
    },
  ],
};

export default sheet;
