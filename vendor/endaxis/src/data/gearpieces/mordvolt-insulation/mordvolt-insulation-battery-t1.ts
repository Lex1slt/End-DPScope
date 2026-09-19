import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Mordvolt Insulation Battery T1',
  icon: '/equipment/wisd01/item_equip_t3_suit_wisd01_edc_02.webp',
  slotType: 'kit',
  levelRequirement: 50,
  defense: 15,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'intellect' },
        target: 'self',
        value: 29,
      },
    ],
  },
  skill2: {
    effects: [
      { kind: 'status', stat: { modifier: 'ultimateGainEfficiency' }, target: 'self', value: 17.5 },
    ],
  },
  setSlug: 'mordvolt-insulation',
};

export default sheet;
