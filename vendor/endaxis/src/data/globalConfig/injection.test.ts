import { describe, expect, it } from 'vitest';
import {
  GLOBAL_CONFIG_SOURCE_LABEL,
  buildGlobalConfigInjection,
  createDefaultOperatorStatModifier,
  createEmptyGlobalConfig,
  normalizeGlobalConfig,
} from './index';

describe('globalConfig injection', () => {
  it('normalizes missing config to empty defaults', () => {
    expect(normalizeGlobalConfig(null)).toEqual(createEmptyGlobalConfig());
  });

  it('builds team operatorStat effects from custom modifiers', () => {
    const mod = createDefaultOperatorStatModifier('comboCooldownReductionPercent');
    mod.value = 20;
    const injection = buildGlobalConfigInjection({
      presetId: null,
      customModifiers: [mod],
    });
    expect(injection.effects).toHaveLength(1);
    expect(injection.effects[0]?.effect).toMatchObject({
      kind: 'status',
      target: 'team',
      value: 20,
      name: GLOBAL_CONFIG_SOURCE_LABEL,
      stat: { modifier: 'cooldownReductionPercent', skillTypes: 'comboSkill' },
    });
  });

  it('drops legacy enemyConstant modifiers during normalize', () => {
    const normalized = normalizeGlobalConfig({
      presetId: null,
      customModifiers: [
        {
          id: 'legacy_en',
          kind: 'enemyConstant',
          field: 'enemyHpMult',
          value: 2,
        },
      ],
    });
    expect(normalized.customModifiers).toEqual([]);
  });

  it('resolves the combo CDR 50% preset into a team cooldown effect', () => {
    const injection = buildGlobalConfigInjection({
      presetId: 'combo-cdr-50',
      customModifiers: [],
    });
    expect(injection.effects[0]?.effect).toMatchObject({
      kind: 'status',
      target: 'team',
      value: 50,
      name: GLOBAL_CONFIG_SOURCE_LABEL,
      stat: { modifier: 'cooldownReductionPercent', skillTypes: 'comboSkill' },
    });
  });
});
