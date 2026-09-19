import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Aburrey UV Lamp',
  icon: '/equipment/atk01/item_equip_t3_suit_atk01_edc_01.webp',
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
        stat: { modifier: 'attributeFlat', attribute: 'agility' },
        target: 'self',
        value: 15,
      },
    ],
  },
  skill3: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'dmgBonus', skillTypes: ['battleSkill', 'comboSkill', 'ultimate'] },
        target: 'self',
        value: 19.6,
      },
    ],
  },
  setSlug: 'aburreys-legacy',
};

export default sheet;
