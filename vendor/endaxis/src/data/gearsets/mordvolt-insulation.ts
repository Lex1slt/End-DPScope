import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'attributeFlat', attribute: 'intellect' },
      target: 'self',
      value: 50,
    },
    {
      kind: 'status',
      stat: { modifier: 'dmgBonus', elements: ['heat', 'cryo', 'electric', 'nature'] },
      target: 'self',
      value: 20,
      condition: { kind: 'operatorHp', compare: 'above', percent: 80 },
      icon: '/equipment/wisd01/item_equip_t2_suit_wisd01_edc_03.webp',
    },
  ],
};

export default sheet;
