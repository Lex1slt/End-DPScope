import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Emergency Comm',
  icon: '/equipment/tundra01/item_equip_t1_parts_tundra01_edc_01.webp',
  slotType: 'kit',
  levelRequirement: 20,
  defense: 6,
  skill1: {
    effects: [{ kind: 'status', stat: { modifier: 'critRate' }, target: 'self', value: 6.6 }],
  },
  setSlug: 'no-set-bonuses',
};

export default sheet;
