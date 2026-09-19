import type { WeaponLevel } from '../types';

export interface SkillBounds {
  min: number;
  max: number;
}

function getEffectiveTuning(level: WeaponLevel, tuned: boolean): number {
  switch (level) {
    case 1:
      return 0;
    case 20:
      return tuned ? 1 : 0;
    case 40:
      return tuned ? 2 : 1;
    case 60:
      return tuned ? 3 : 2;
    case 80:
      return tuned ? 4 : 3;
    case 90:
      return 4;
  }
}

export function getSkillBounds(
  level: WeaponLevel,
  tuned: boolean,
  potential: number,
): {
  skill1: SkillBounds;
  skill2: SkillBounds;
  skill3: SkillBounds;
} {
  const t = getEffectiveTuning(level, tuned);
  return {
    skill1: { min: 1 + Math.ceil(t / 2), max: 3 + Math.ceil(t * 1.5) },
    skill2: { min: 1 + Math.floor(t / 2), max: 3 + Math.floor(t * 1.5) },
    skill3: { min: 1 + potential, max: 4 + potential },
  };
}

export function clampSkillLevel(value: number, bounds: SkillBounds): number {
  return Math.max(bounds.min, Math.min(bounds.max, value));
}
