import type { GearSetSheet } from '../types';

const sheet: GearSetSheet = {
  effects: [
    {
      kind: 'status',
      stat: { modifier: 'flatHp' },
      target: 'self',
      value: 500,
    },
  ],
};

export default sheet;
