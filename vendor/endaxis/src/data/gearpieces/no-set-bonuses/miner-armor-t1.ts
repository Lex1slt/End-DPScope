import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Miner Armor T1',
  icon: '/equipment/tundra01/item_equip_t3_parts_tundra01_body_01.webp',
  slotType: 'armor',
  levelRequirement: 50,
  defense: 40,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'strength' },
        target: 'self',
        value: 65,
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'will' },
        target: 'self',
        value: 43,
      },
    ],
  },
  skill3: {
    effects: [{ kind: 'status', stat: { modifier: 'critRate' }, target: 'self', value: 3.9 }],
  },
  setSlug: 'no-set-bonuses',
};

export default sheet;
