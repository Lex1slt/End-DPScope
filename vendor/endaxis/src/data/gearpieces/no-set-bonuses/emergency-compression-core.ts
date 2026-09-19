import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Emergency Compression Core',
  icon: '/equipment/tundra01/item_equip_t1_parts_tundra01_edc_02.webp',
  slotType: 'kit',
  levelRequirement: 20,
  defense: 6,
  skill1: {
    effects: [{ kind: 'status', stat: { modifier: 'atkPercent' }, target: 'self', value: 13.2 }],
  },
  setSlug: 'no-set-bonuses',
};

export default sheet;
