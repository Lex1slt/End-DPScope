import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Roving MSGR Jacket T1',
  icon: '/equipment/agi01/item_equip_t3_suit_agi01_body_01.webp',
  slotType: 'armor',
  levelRequirement: 50,
  defense: 40,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'agility' },
        target: 'self',
        value: 61,
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'intellect' },
        target: 'self',
        value: 41,
      },
    ],
  },
  skill3: {
    effects: [{ kind: 'status', stat: { modifier: 'hpPercent' }, target: 'self', value: 14.7 }],
  },
  setSlug: 'roving-msgr',
};

export default sheet;
