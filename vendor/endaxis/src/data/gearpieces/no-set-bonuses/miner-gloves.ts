import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Miner Gloves',
  icon: '/equipment/tundra01/item_equip_t1_parts_tundra01_hand_03.webp',
  slotType: 'gloves',
  levelRequirement: 20,
  defense: 12,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'intellect' },
        target: 'self',
        value: 20,
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'will' },
        target: 'self',
        value: 13,
      },
    ],
  },
  skill3: {
    effects: [{ kind: 'status', stat: { modifier: 'hpPercent' }, target: 'self', value: 11 }],
  },
  setSlug: 'no-set-bonuses',
};

export default sheet;
