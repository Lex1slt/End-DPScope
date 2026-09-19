export type { GlobalConfigPreset, GlobalConfigState, GlobalModifier } from './types';
export { createEmptyGlobalConfig } from './types';
export { GLOBAL_CONFIG_PRESETS, getGlobalConfigPreset } from './presets';
export {
  GLOBAL_CONFIG_OPERATOR_STAT_CHOICES,
  GLOBAL_CONFIG_SOURCE_LABEL,
  buildGlobalConfigInjection,
  createDefaultOperatorStatModifier,
  formatGlobalModifierLabel,
  normalizeGlobalConfig,
} from './injection';
