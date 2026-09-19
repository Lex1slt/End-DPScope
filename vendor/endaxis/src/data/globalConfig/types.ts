import type { Effect, TriggerEffect } from '@/data/types';
import { OPERATOR_STAT_MODIFIERS } from '@/data/enums';

export type OperatorStatModifier = (typeof OPERATOR_STAT_MODIFIERS)[number];

export interface GlobalOperatorStatModifier {
  id: string;
  kind: 'operatorStat';
  modifier: OperatorStatModifier;
  value: number;
  skillTypes?: string | string[];
}

export interface GlobalEffectModifier {
  id: string;
  kind: 'effect';
  effect: Effect;
}

export type GlobalModifier = GlobalOperatorStatModifier | GlobalEffectModifier;

export interface GlobalConfigState {
  /** Active preset id; null means none. Single-select. */
  presetId: string | null;
  customModifiers: GlobalModifier[];
}

export interface GlobalConfigInjection {
  effects: Array<{
    effect: Effect;
    sourceSlotIndex: number;
    sourceOperatorSlug: string;
  }>;
  triggers: Array<{
    triggerEffect: TriggerEffect;
    sourceSlotIndex: number;
    sourceOperatorSlug: string;
    sourceSkillType?: string;
    sourceTrackId?: string | null;
  }>;
}

export interface GlobalConfigPreset {
  id: string;
  /** Display name (Chinese, same approach as Contingency Contract JSON). */
  name: string;
  /** Optional short description shown on the tile. */
  description?: string;
  resolve: () => {
    modifiers?: GlobalModifier[];
    effects?: Effect[];
    triggers?: TriggerEffect[];
  };
}

export function createEmptyGlobalConfig(): GlobalConfigState {
  return { presetId: null, customModifiers: [] };
}
