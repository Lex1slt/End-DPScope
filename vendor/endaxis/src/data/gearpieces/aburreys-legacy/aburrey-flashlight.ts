import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Aburrey Flashlight',
  icon: '/equipment/atk01/item_equip_t3_suit_atk01_edc_04.webp',
  slotType: 'kit',
  levelRequirement: 50,
  defense: 15,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'intellect' },
        target: 'self',
        value: 23,
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'strength' },
        target: 'self',
        value: 15,
      },
    ],
  },
  skill3: {
    effects: [
      { kind: 'status', stat: { modifier: 'ultimateGainEfficiency' }, target: 'self', value: 17.5 },
    ],
  },
  setSlug: 'aburreys-legacy',
};

export default sheet;
