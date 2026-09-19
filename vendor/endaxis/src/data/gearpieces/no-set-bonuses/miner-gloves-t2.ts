import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Miner Gloves T2',
  icon: '/equipment/tundra01/item_equip_t3_parts_tundra01_hand_01.webp',
  slotType: 'gloves',
  levelRequirement: 50,
  defense: 30,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'intellect' },
        target: 'self',
        value: 49,
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'agility' },
        target: 'self',
        value: 32,
      },
    ],
  },
  skill3: {
    effects: [{ kind: 'status', stat: { modifier: 'atkPercent' }, target: 'self', value: 13 }],
  },
  setSlug: 'no-set-bonuses',
};

export default sheet;
