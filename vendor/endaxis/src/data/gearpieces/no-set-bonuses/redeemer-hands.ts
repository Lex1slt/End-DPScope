import type { GearPieceSheet } from '../../types';

const sheet: GearPieceSheet = {
  name: 'Redeemer Hands',
  icon: '/equipment/wuling01/item_equip_t4_parts_wuling01_hand_02.webp',
  slotType: 'gloves',
  levelRequirement: 70,
  defense: 42,
  skill1: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'attributeFlat', attribute: 'strength' },
        target: 'self',
        value: [86, 94, 103, 111],
      },
    ],
  },
  skill2: {
    effects: [
      {
        kind: 'status',
        stat: { modifier: 'dmgBonus', skillTypes: ['battleSkill', 'comboSkill', 'ultimate'] },
        target: 'self',
        value: [24, 26.4, 28.8, 31.2],
      },
    ],
  },
  setSlug: 'no-set-bonuses',
};

export default sheet;
