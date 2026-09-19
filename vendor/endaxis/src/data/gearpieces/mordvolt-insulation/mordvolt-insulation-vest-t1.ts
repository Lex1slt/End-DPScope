import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Mordvolt Insulation Vest T1',
  icon: '/equipment/wisd01/item_equip_t3_suit_wisd01_body_01.webp',
  slotType: 'armor',
  levelRequirement: 50,
  defense: 40,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'intellect' },
        target: 'self',
        value: 61,
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'agility' },
        target: 'self',
        value: 41,
      },
    ],
  },
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'dmgBonus', skillTypes: 'basicAttack' },
        target: 'self',
        value: 9.8,
      },
    ],
  },
  setSlug: 'mordvolt-insulation',
};

export default sheet;
