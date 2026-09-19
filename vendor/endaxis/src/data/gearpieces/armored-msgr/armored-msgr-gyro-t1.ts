import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Armored MSGR Gyro T1',
  icon: '/equipment/str01/item_equip_t3_suit_str01_edc_01.webp',
  slotType: 'kit',
  levelRequirement: 50,
  defense: 15,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'strength' },
        target: 'self',
        value: 23,
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'will' },
        target: 'self',
        value: 15,
      },
    ],
  },
  skill3: {
    effects: [{ kind: 'status', stat: { modifier: 'atkPercent' }, target: 'self', value: 14.7 }],
  },
  setSlug: 'armored-msgr',
};

export default sheet;
