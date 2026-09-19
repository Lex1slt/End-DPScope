import { describe, expect, test } from 'vitest';
import {
  getOperatorCombatSkillDescription,
  getOperatorCombatSkillFormKeys,
  getOperatorFormName,
  getWeaponGameName,
  getWeaponSkillDescription,
  getWeaponSkillName,
} from './gameText';

describe('game text localization', () => {
  test('zh localizes Blessing of Lustrous Carmine', () => {
    expect(getWeaponGameName('blessing-of-lustrous-carmine', 'zh-CN')).toBe('镀红祝福');
  });

  test('zh localizes Blessing of Lustrous Carmine skill entries', () => {
    expect(getWeaponSkillName('blessing-of-lustrous-carmine', 'skill1', 'zh-CN')).toBe('敏捷');
    expect(getWeaponSkillName('blessing-of-lustrous-carmine', 'skill2', 'zh-CN')).toBe('灼热伤害');
    expect(getWeaponSkillName('blessing-of-lustrous-carmine', 'skill3', 'zh-CN')).toBe('镀红祝福');
  });

  test('zh keeps arts-unit weapons with swapped icon IDs mapped to the correct skills', () => {
    expect(getWeaponSkillDescription('detonation-unit', 'skill3', 'zh-CN', 1)).toContain(
      '法术爆发',
    );
    expect(getWeaponSkillDescription('detonation-unit', 'skill3', 'zh-CN', 1)).not.toContain(
      '治疗',
    );
    expect(getWeaponSkillDescription('chivalric-virtues', 'skill3', 'zh-CN', 1)).toContain('治疗');
    expect(getWeaponSkillDescription('chivalric-virtues', 'skill3', 'zh-CN', 1)).not.toContain(
      '法术爆发',
    );
  });

  test('zh reads operator form labels separately from form-specific skill descriptions', () => {
    expect(getOperatorFormName('arcane', 'int', 'zh-CN')).toBe('阵诀·智');
    expect(getOperatorFormName('arcane', 'will', 'zh-CN')).toBe('阵诀·意');
    expect(getOperatorCombatSkillFormKeys('arcane', 'comboSkill', 'zh-CN')).toEqual([
      'int',
      'will',
    ]);
    expect(getOperatorCombatSkillDescription('arcane', 'comboSkill', 'zh-CN', 'int')).toContain(
      '阵诀·智',
    );
    expect(getOperatorCombatSkillDescription('arcane', 'comboSkill', 'zh-CN', 'will')).toContain(
      '阵诀·意',
    );
  });
});
