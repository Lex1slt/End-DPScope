import type {
  OperatorStat,
  EnemyStat,
  EffectStat,
  DamageElement,
  SkillType,
  ResolvedScalingDef,
} from '../types';

// ─── Attributes ────────────────────────────────────────────────────────────

export interface Attributes {
  strength: number;
  agility: number;
  intellect: number;
  will: number;
}

// ─── Base stat values (from operator/weapon sheets at a given level) ───────

export interface BaseStatValues {
  level: number;
  baseAtk: number;
  baseHp: number;
  weaponAtk: number;
  baseAttrs: Attributes;
  mainAttributeName: string;
  secondaryAttributeName: string;
  /**
   * Intrinsic baselines carried from OperatorInstance.baseStatOverrides
   * (crit / arts / ult efficiency / defense). Applied in computeStats.
   */
  intrinsicOverrides?: {
    critRate?: number;
    critDmg?: number;
    artsIntensity?: number;
    ultimateGainEfficiency?: number;
    defense?: number;
    /** Percentage points; applied as Π(1 − pct/100) seed. */
    comboCdReductionPercent?: number;
  };
}

// ─── Resolved stat modifier (universal interface) ──────────────────────────

/**
 * A fully resolved, flat stat modifier ready for accumulation.
 *
 * Both sheet effects (after value/level resolution) and simulation effects
 * (from OperatorEffectState.getActiveEntries) produce this same shape.
 *
 * Sheet effects that have ScalingDef are NOT represented here — they are
 * passed as raw StatusEffect objects to computeStats so that attribute-
 * dependent scaling can be resolved with the correct attrs at each time T.
 */
export interface ResolvedStatModifier {
  stat: OperatorStat | EnemyStat;
  /** Fully resolved numeric value (value * stacks for simulation effects). */
  value: number;
  /** Effect ID — used for gear defense identification (id ending with ':defense'). */
  effectId?: string;
  /** Source operator track ID — used for LMDI contribution attribution. */
  sourceId?: string;
  external?: boolean;
  /** Display name key (effect.name) for hit-detail source lines. */
  sourceLabel?: string;
}

// ─── Sheet stat effect (input to computeStats) ────────────────────────────

/**
 * A sheet-sourced stat effect that may need attribute/scaling resolution.
 * Extracted from ResolvedStatusEffect — only the fields computeStats needs.
 */
export interface SheetStatEffect {
  stat: EffectStat;
  value?: number;
  scaling?: ResolvedScalingDef;
  id?: string;
  external?: boolean;
  /** Display name for source attribution (talent / set / piece name). */
  name?: string;
}

/**
 * A named contribution to a scalar operator stat (crit, arts intensity, CDR, …).
 * `value` uses the same units as the parent aggregate (decimal for rates, raw for flat).
 */
export interface StatSourceEntry {
  label: string;
  value: number;
}

/**
 * A named contribution to an operator attribute (力量 / 敏捷 / …).
 * `kind` selects how `value` is displayed and how it entered the formula.
 */
export interface AttributeSourceEntry {
  label: string;
  /** Flat points, percent decimal (0.08 = +8%), or external factor (e.g. 1.1). */
  value: number;
  kind: 'base' | 'flat' | 'percent' | 'external';
}

// ─── Scoped damage modifier ────────────────────────────────────────────────

/**
 * A damage modifier with its full scope preserved.
 * Stored in OperatorStatus output; filtered by the damage calculator at hit time.
 */
export interface ScopedDamageModifier {
  modifier:
    'dmgBonus' | 'ampBonus' | 'directMultiplier' | 'resistanceIgnore' | 'susceptibilityAmplify';
  value: number;
  elements?: DamageElement | DamageElement[];
  skillTypes?: SkillType | SkillType[] | 'nonSkill';
  skillId?: string | string[];
  external?: boolean;
  /** Runtime effect id / sheet effect id for source attribution in hit detail. */
  effectId?: string;
  /** Display name key (effect.name) when available. */
  sourceLabel?: string;
}
