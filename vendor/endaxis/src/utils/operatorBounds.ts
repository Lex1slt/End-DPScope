import type { OperatorLevel } from '../types';

export function getOperatorSkillMax(level: OperatorLevel, promoted: boolean): number {
  if (level <= 20) return 3;
  if (level <= 40) return promoted ? 6 : 3;
  if (level <= 60) return promoted ? 9 : 6;
  if (level <= 80) return promoted ? 12 : 9;
  return 12;
}

export function clampOperatorSkillLevel(value: number, max: number): number {
  return Math.max(1, Math.min(max, value));
}

export function skillLevelLabel(level: number): string {
  if (level <= 9) return String(level);
  return `M${level - 9}`;
}
