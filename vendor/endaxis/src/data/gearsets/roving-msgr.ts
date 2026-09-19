import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'attributeFlat', attribute: 'agility' },
      target: 'self',
      value: 50,
    },
    {
      kind: 'status',
      stat: { modifier: 'dmgBonus', elements: 'physical' },
      target: 'self',
      value: 20,
      condition: { kind: 'operatorHp', compare: 'above', percent: 80 },
      icon: '/equipment/agi01/item_equip_t3_suit_agi01_edc_03.webp',
    },
  ],
};

export default sheet;
