import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'attributeFlat', attribute: 'strength' },
      target: 'self',
      value: 50,
    },
  ],
};

export default sheet;
