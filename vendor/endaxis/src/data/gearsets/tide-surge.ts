import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'dmgBonus', skillTypes: ['battleSkill', 'comboSkill', 'ultimate'] },
      target: 'self',
      value: 20,
    },
  ],
  triggers: [
    {
      trigger: {
        kind: 'onStatusApplied',
        status: ['cryoInfliction', 'electricInfliction', 'natureInfliction', 'heatInfliction'],
        target: 'enemy',
      },
      effects: [
        {
          kind: 'status',
          stat: { modifier: 'dmgBonus', elements: ['heat', 'cryo', 'electric', 'nature'] },
          target: 'self',
          value: 35,
          duration: 15,
          condition: {
            kind: 'enemyStatus',
            status: ['cryoInfliction', 'electricInfliction', 'natureInfliction', 'heatInfliction'],
            stacks: { compare: 'atLeast', count: 2 },
          },
          icon: '/equipment/burst01/item_equip_t4_suit_burst01_edc_01.webp',
        },
      ],
    },
  ],
};

export default sheet;
