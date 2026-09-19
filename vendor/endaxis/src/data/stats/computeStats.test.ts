import { describe, expect, it } from 'vitest';
import { computeStats, STAT_SOURCE_BASE_LABEL } from './computeStats';
import type { BaseStatValues, ResolvedStatModifier, SheetStatEffect } from './types';

const BASE: BaseStatValues = {
  level: 60,
  baseAtk: 1000,
  baseHp: 1000,
  weaponAtk: 0,
  baseAttrs: { strength: 0, agility: 0, intellect: 0, will: 0 },
  mainAttributeName: 'strength',
  secondaryAttributeName: 'agility',
};

describe('computeStats — dynamic attributeAtkPercent', () => {
  it('applies a dynamic (runtime) attributeAtkPercent buff to ATK', () => {
    const without = computeStats(BASE, [], []);
    const withBuff = computeStats(
      BASE,
      [],
      [{ stat: { modifier: 'attributeAtkPercent' }, value: 10 } as unknown as ResolvedStatModifier],
    );

    expect(without.attack).toBe(1000);
    expect(withBuff.attack).toBe(1100);
    expect(withBuff.attack).toBeGreaterThan(without.attack);
  });
});

describe('computeStats — attributeSources', () => {
  it('lists base, flat, percent, and external contributions per attribute', () => {
    const base: BaseStatValues = {
      ...BASE,
      baseAttrs: { strength: 100, agility: 200, intellect: 50, will: 40 },
    };
    const sheet: SheetStatEffect[] = [
      {
        name: 'weapon-agility',
        stat: { modifier: 'attributeFlat', attribute: 'agility' },
        value: 50,
      },
      {
        name: 'set-all-pct',
        stat: {
          modifier: 'attributePercent',
          attribute: ['strength', 'agility', 'intellect', 'will'],
        },
        value: 10,
      },
      {
        name: 'external-str',
        stat: { modifier: 'attributePercent', attribute: 'strength' },
        value: 20,
        external: true,
      },
    ];
    const status = computeStats(base, sheet, []);

    expect(status.attributeSources.agility).toEqual(
      expect.arrayContaining([
        { label: STAT_SOURCE_BASE_LABEL, value: 200, kind: 'base' },
        { label: 'weapon-agility', value: 50, kind: 'flat' },
        { label: 'set-all-pct', value: 0.1, kind: 'percent' },
      ]),
    );
    expect(status.attributeSources.strength).toEqual(
      expect.arrayContaining([
        { label: STAT_SOURCE_BASE_LABEL, value: 100, kind: 'base' },
        { label: 'set-all-pct', value: 0.1, kind: 'percent' },
        { label: 'external-str', value: 1.2, kind: 'external' },
      ]),
    );
    // (100+0)*1.1*1.2 = 132
    expect(status.attributes.strength).toBe(132);
    // (200+50)*1.1 = 275
    expect(status.attributes.agility).toBe(275);
  });
});

describe('computeStats — intrinsicOverrides', () => {
  it('replaces intrinsic crit / arts / ult / defense baselines', () => {
    const status = computeStats(
      {
        ...BASE,
        intrinsicOverrides: {
          critRate: 0.2,
          critDmg: 1.0,
          artsIntensity: 40,
          ultimateGainEfficiency: 15,
          defense: 100,
          comboCdReductionPercent: 20,
        },
      },
      [],
      [],
    );

    expect(status.critRate).toBeCloseTo(0.2);
    expect(status.critDmg).toBeCloseTo(1.0);
    expect(status.artsIntensity).toBe(40);
    expect(status.ultimateGainEfficiency).toBe(15);
    expect(status.defense).toBe(100);
    expect(status.comboCdExternalMult).toBeCloseTo(0.8);
    expect(status.critRateSources).toEqual(
      expect.arrayContaining([{ label: STAT_SOURCE_BASE_LABEL, value: 0.2 }]),
    );
    expect(status.critDmgSources).toEqual(
      expect.arrayContaining([{ label: STAT_SOURCE_BASE_LABEL, value: 1.0 }]),
    );
    expect(status.comboCdReductionPercentSources).toEqual(
      expect.arrayContaining([{ label: STAT_SOURCE_BASE_LABEL, value: 20 }]),
    );
  });
});
