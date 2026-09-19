import type { ScopedDamageModifier } from './data/stats/types';
import type { StatSourceEntry, AttributeSourceEntry } from './data/stats/types';

export type { StatSourceEntry, AttributeSourceEntry };

// ─── Operators ───────────────────────────────────────────────────────────────

export interface OperatorListEntry {
  slug: string;
  rarity: number;
  class: string;
  new?: boolean;
  beta?: boolean;
}

// ─── Operator Instances ──────────────────────────────────────────────────────

export type OperatorLevel = 1 | 20 | 40 | 60 | 80 | 90;

/** Absolute overrides for sheet/intrinsic baselines on an operator instance. */
export interface OperatorBaseStatOverrides {
  strength?: number;
  agility?: number;
  intellect?: number;
  will?: number;
  baseAtk?: number;
  baseHp?: number;
  /** Decimal, e.g. 0.05 = 5%. */
  critRate?: number;
  /** Decimal, e.g. 0.5 = 50%. */
  critDmg?: number;
  artsIntensity?: number;
  /** Percentage points of ult gain efficiency (0 → 100% display). */
  ultimateGainEfficiency?: number;
  /** Intrinsic flat defense seed. */
  defense?: number;
  /** Combo skill percent CDR baseline in percentage points (e.g. 15 = 15%). */
  comboCdReductionPercent?: number;
}

export interface OperatorInstance {
  id: string;
  operatorSlug: string;
  level: OperatorLevel;
  promoted: boolean;
  potential: number;
  skillLevels: Record<string, number>;
  talentStates: Record<string, number>;
  trustLevel: number;
  /** Optional absolute replacements for base/intrinsic stats. */
  baseStatOverrides?: OperatorBaseStatOverrides;
}

// ─── Weapons ─────────────────────────────────────────────────────────────────

export interface WeaponListEntry {
  slug: string;
  rarity: number;
  type: string;
}

export type WeaponLevel = 1 | 20 | 40 | 60 | 80 | 90;

export interface WeaponInstance {
  id: string;
  weaponSlug: string;
  level: WeaponLevel;
  tuned: boolean;
  potential: number;
  skill1Level: number;
  skill2Level: number;
  skill3Level: number;
}

// ─── Gear ────────────────────────────────────────────────────────────────────

export interface GearInstance {
  id: string;
  gearPieceId: string;
  /** Artificing level (0–3) per effect, indexed by position. Missing index = 0. */
  artificingLevels: number[];
}

export interface GearPieceListEntry {
  slug: string;
  slotType: string;
  levelRequirement: number;
  setSlug?: string;
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export interface TeamGearSlots {
  armor: string | null;
  gloves: string | null;
  kit1: string | null;
  kit2: string | null;
}

export interface TeamSlot {
  operatorId: string | null;
  weaponId: string | null;
  gear: TeamGearSlots;
}

export interface TeamInstance {
  id: string;
  name: string;
  slots: [TeamSlot, TeamSlot, TeamSlot, TeamSlot];
}

// ─── Status Snapshots ────────────────────────────────────────────────────────

export interface OperatorStatus {
  // Final computed stats
  attack: number;
  health: number;
  defense: number;
  critRate: number;
  critDmg: number;
  artsIntensity: number;
  ultimateGainEfficiency: number;

  // Attributes (resolved, after all bonuses)
  attributes: {
    strength: number;
    agility: number;
    intellect: number;
    will: number;
  };
  /** Per-attribute named contributions for expandable source details. */
  attributeSources: {
    strength: AttributeSourceEntry[];
    agility: AttributeSourceEntry[];
    intellect: AttributeSourceEntry[];
    will: AttributeSourceEntry[];
  };

  // Main/sub attribute metadata
  mainAttributeName: string;
  secondaryAttributeName: string;
  mainAttribute: number;
  secondaryAttribute: number;

  // Attack subcomponents
  baseAtk: { operator: number; weapon: number };
  atkPercent: number;
  flatAtk: number;
  /** Named contributions to `atkPercent` (decimal, e.g. 0.2 = +20%). */
  atkPercentSources: StatSourceEntry[];

  // Per-attribute ATK coefficients (e.g. main=0.005, sub=0.002, others=0 by default)
  attrAtkCoeff: { strength: number; agility: number; intellect: number; will: number };

  // HP subcomponents
  baseHp: number;
  hpPercent: number;
  flatHp: number;

  // DEF subcomponents
  baseDef: number;
  gearDefense: number;
  defPercent: number;
  flatDef: number;

  // SP recovery modifiers
  spRecoveryFlat: number;
  spRecoveryPercent: number;

  // Ultimate energy modifiers
  ultimateEnergyCostReduction: number;

  // Cooldown reduction (static, from potentials/talents/gear)
  /** Flat seconds removed from comboSkill cooldown. */
  comboCdReductionFlat: number;
  /** Flat seconds removed from ultimate cooldown. */
  ultCdReductionFlat: number;
  /** Unused for percent CDR (always 0); percent sources use comboCdExternalMult. */
  comboCdReductionPercent: number;
  /** Unused for percent CDR (always 0); percent sources use ultCdExternalMult. */
  ultCdReductionPercent: number;
  /** Combo skill cooldown factor Π(1 − pct/100) from `cooldownReductionPercent`; 1 = none. */
  comboCdExternalMult: number;
  /** Ultimate cooldown factor Π(1 − pct/100) from `cooldownReductionPercent`; 1 = none. */
  ultCdExternalMult: number;

  /** Named contributions for expandable source details in the attribute panel. */
  critRateSources: StatSourceEntry[];
  critDmgSources: StatSourceEntry[];
  artsIntensitySources: StatSourceEntry[];
  ultimateGainEfficiencySources: StatSourceEntry[];
  /** Percent-point contributions (e.g. 50 = 50% CDR factor). */
  comboCdReductionPercentSources: StatSourceEntry[];
  comboCdReductionFlatSources: StatSourceEntry[];

  // Damage modifiers (scoped by element/skill — filtered by damage calculator at hit time)
  damageModifiers: ScopedDamageModifier[];
}

export interface ComputedEnemyStatus {
  susceptibility: number;
  resistanceShred: number;
  defReduction: number;
  increasedDmgTaken: number;
  dmgReductionEffects: number[];
  elementalSusceptibility: Record<string, number>;
  elementalIncreasedDmgTaken: Record<string, number>;
  /** Standalone-multiplicative damage-taken factor (external increasedDmgTaken, e.g. Wrap); 1 = none. */
  increasedDmgTakenExternalMult: number;
  elementalIncreasedDmgTakenExternalMult: Record<string, number>;
}
