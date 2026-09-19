import type { GlobalConfigPreset } from './types';

/**
 * Author-defined scenario packs (single-select in the UI).
 * Display copy is embedded Chinese like Contingency Contract JSON — not vue-i18n keys.
 * Simulation logic stays in `resolve()` (and future mechanism helpers).
 */
export const GLOBAL_CONFIG_PRESETS: GlobalConfigPreset[] = [
  {
    id: 'combo-cdr-50',
    name: '连携加速',
    description: '全队连携冷却缩减 50%',
    resolve: () => ({
      modifiers: [
        {
          id: 'preset:combo-cdr-50',
          kind: 'operatorStat',
          modifier: 'cooldownReductionPercent',
          skillTypes: 'comboSkill',
          value: 50,
        },
      ],
    }),
  },
];

export function getGlobalConfigPreset(id: string | null | undefined): GlobalConfigPreset | null {
  if (!id) return null;
  return GLOBAL_CONFIG_PRESETS.find(preset => preset.id === id) ?? null;
}
