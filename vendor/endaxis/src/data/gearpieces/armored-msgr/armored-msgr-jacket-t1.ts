import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Armored MSGR Jacket T1',
  icon: '/equipment/str01/item_equip_t3_suit_str01_body_01.webp',
  slotType: 'armor',
  levelRequirement: 50,
  defense: 40,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'strength' },
        target: 'self',
        value: 61,
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'will' },
        target: 'self',
        value: 41,
      },
    ],
  },
  skill3: {
    effects: [{ kind: 'status', stat: { modifier: 'hpPercent' }, target: 'self', value: 14.7 }],
  },
  setSlug: 'armored-msgr',
};

export default sheet;
