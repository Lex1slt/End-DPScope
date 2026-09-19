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
      trigger: {
        kind: 'onActionStart',
        skillTypes: 'comboSkill',
      },
      effects: [
        {
          kind: 'status',
          stat: { modifier: 'dmgBonus', skillTypes: ['battleSkill', 'comboSkill', 'ultimate'] },
          target: 'self',
          stackStrategy: 'INDEPENDENT',
          maxStacks: 2,
          value: 20,
          duration: 15,
          icon: '/equipment/combo_cd01/item_equip_t4_suit_combo_cd01_body_01.webp',
        },
      ],
    },
  ],
};

export default sheet;
