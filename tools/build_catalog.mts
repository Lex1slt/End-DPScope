// 生成前端用的装备/武器目录：dps_end/data/catalog.json
//
// 前端「队伍配置」里的武器/装备下拉需要的是**纯字符串**名字；模拟器的 i18n 表
// 里 name/setName 是 { name, ... } 这种对象，直接塞进 JSX 会触发
// React error #31（Objects are not valid as a React child）。
// 所以这里在生成阶段就把它们压平成字符串，顺带带上：
//   装备 → 防御、三条词条（名称 + 各精锻等级的数值）、套装效果
//   武器 → 三条技能（名称 + 各等级数值 + 是否百分比 + 描述模板）
// 词条/精锻语义与引擎一致（src/data/collect.ts:483）：
//   artificingLevels[slotIdx] 对应 skill{slotIdx+1}，等级 0~3。
//
// Usage: cd vendor/endaxis && node node_modules/vite-node/dist/cli.mjs --config dpsend.vite.config.ts ../../tools/build_catalog.mts

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getGearPiece, getGearPieceList, getWeapon, getWeaponList } from '@/data/index';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const zhDir = resolve(repoRoot, 'vendor/endaxis/src/i18n/game-locales/zh');

function readTable(name: string): Record<string, any> {
  return JSON.parse(readFileSync(resolve(zhDir, `${name}.json`), 'utf-8'));
}

/** i18n 表里同一个字段可能是字符串，也可能是 { name } / { setName } 这种对象。 */
function flatten(node: unknown, key: string): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object') {
    const rec = node as Record<string, any>;
    const hit = rec[key];
    if (typeof hit === 'string') return hit;
    if (hit && typeof hit === 'object' && typeof hit[key] === 'string') return hit[key];
  }
  return '';
}

/** 去掉游戏富文本标记，保留 {0} 这类数值占位符。 */
function stripRichText(text: unknown): string {
  return typeof text === 'string' ? text.replace(/<[^>]+>/g, '') : '';
}

const zhWeapons = readTable('weapons');
const zhGearPieces = readTable('gearpieces');
const zhGearSets = readTable('gearsets');

const ZH_ATTRIBUTE: Record<string, string> = {
  strength: '力量',
  agility: '敏捷',
  intellect: '智识',
  will: '意志',
  hp: '生命',
  atk: '攻击',
};

// 这两类之外的 modifier 一律按百分比理解（dmgBonus/critRate/hpPercent 等）
const FLAT_MODIFIERS = new Set(['attributeFlat', 'atkFlat', 'flatHp', 'heal']);

function firstStatusEffect(skill: any): any | null {
  for (const raw of (skill?.effects ?? []) as any[]) {
    if (raw?.kind === 'status') return raw;
  }
  return null;
}

/** 装备第 i 条词条的显示名：优先 i18n statNames[i]，兜底按属性/加成类型推断。 */
function affixName(zh: any, index: number, skill: any): string {
  const names = Array.isArray(zh?.statNames) ? zh.statNames : [];
  if (typeof names[index] === 'string' && names[index]) return names[index];
  const stat = firstStatusEffect(skill)?.stat ?? {};
  if (typeof stat.attribute === 'string' && ZH_ATTRIBUTE[stat.attribute]) {
    return ZH_ATTRIBUTE[stat.attribute];
  }
  if (stat.modifier === 'dmgBonus') {
    return stat.skillTypes === 'comboSkill' ? '连携技伤害加成' : '伤害加成';
  }
  if (stat.modifier === 'critRate') return '暴击率';
  if (stat.modifier === 'hpPercent') return '生命';
  if (stat.modifier === 'susceptibility') return '易伤';
  return `词条${index + 1}`;
}

/** 词条数值：数组长 4 → 4 级精锻；标量 → 不随精锻变化。 */
function affixValue(skill: any): { value: number | null; levels: number[] | null; isPercent: boolean } {
  const effect = firstStatusEffect(skill);
  const raw = effect?.value;
  const isPercent = !(FLAT_MODIFIERS.has(effect?.stat?.modifier));
  if (Array.isArray(raw) && raw.length > 0 && raw.every((v: any) => typeof v === 'number')) {
    return { value: raw[raw.length - 1], levels: raw as number[], isPercent };
  }
  if (typeof raw === 'number') return { value: raw, levels: null, isPercent };
  return { value: null, levels: null, isPercent };
}

const weapons = getWeaponList()
  .map((w) => {
    const sheet = getWeapon(w.slug) as any;
    const zh = zhWeapons[w.slug];
    const skills = (['skill1', 'skill2', 'skill3'] as const)
      .map((key) => {
        // 数值表以 sheet 为准（技能是否存在、等级上限），名字/描述/百分比取 i18n；
        // 低星武器 i18n 缺名字时按属性/加成类型推断，推不出来就不展示这条
        const node = (sheet ?? {})[key];
        const localized = (zh ?? {})[key];
        if (!node && !localized) return null;
        let name = flatten(localized, 'name');
        if (!name) {
          const eff = firstStatusEffect(node);
          const st = eff?.stat ?? {};
          if (typeof st.attribute === 'string' && ZH_ATTRIBUTE[st.attribute]) {
            name = ZH_ATTRIBUTE[st.attribute];
          } else if (st.modifier === 'atkPercent' || st.modifier === 'atkFlat') {
            name = '攻击力';
          } else if (st.modifier === 'dmgBonus') {
            name = '伤害加成';
          }
        }
        if (!name) return null;
        const values = Array.isArray(localized?.values) ? localized.values : [];
        return {
          key,
          name,
          values,
          isPercent: !!localized?.isPercent,
          desc: stripRichText(localized?.description),
        };
      })
      .filter(Boolean);
    return {
      slug: w.slug,
      type: w.type ?? '',
      typeZh: flatten(zhWeapons[w.slug], 'type') || '',
      rarity: w.rarity ?? 0,
      name: flatten(zhWeapons[w.slug], 'name') || w.slug,
      skills,
      gameId: String((sheet as any)?.icon ?? '').split('/').pop()?.replace(/\.webp$/, '') || '',
    };
  })
  .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh'));

const gearpieces = getGearPieceList()
  .map((piece) => {
    const sheet = getGearPiece(piece.slug) as any;
    const zh = zhGearPieces[piece.slug];
    const setRow = piece.setSlug ? zhGearSets[piece.setSlug] : null;
    const affixes = (['skill1', 'skill2', 'skill3'] as const)
      .map((key, index) => {
        const skill = (sheet ?? {})[key];
        if (!skill) return null;
        const { value, levels, isPercent } = affixValue(skill);
        if (value == null) return null;
        return {
          name: affixName(zh, index, skill),
          value,
          levels,
          isPercent,
        };
      })
      .filter(Boolean);
    return {
      slug: piece.slug,
      slotType: piece.slotType ?? '',
      name: flatten(zh, 'name') || piece.slug,
      set: piece.setSlug ?? '',
      setName: flatten(zh, 'setName') || flatten(setRow, 'setName'),
      setEffect: flatten(setRow, 'description').replace(/<[^>]+>/g, ''),
      defense: typeof sheet?.defense === 'number' ? sheet.defense : null,
      affixes,
      // 游戏内部物品ID（从图标路径提取），供运行时到 AKEData 换取官方中文名
      gameId: String(sheet?.icon ?? '').split('/').pop()?.replace(/\.webp$/, '') || '',
    };
  })
  .sort((a, b) => a.slotType.localeCompare(b.slotType) || a.name.localeCompare(b.name, 'zh'));

const out = { generatedAt: new Date().toISOString().slice(0, 10), weapons, gearpieces };
const outPath = resolve(repoRoot, 'dps_end/data/catalog.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out), 'utf-8');

const bad = [...weapons, ...gearpieces].filter((x) => typeof x.name !== 'string' || !x.name);
const noAffix = gearpieces.filter((g) => g.affixes.length === 0).length;
console.log(`catalog: ${weapons.length} weapons / ${gearpieces.length} gearpieces -> ${outPath}`);
console.log(`非字符串名称: ${bad.length} | 无词条部件: ${noAffix} | 武器技能总数: ${weapons.reduce((s, w) => s + w.skills.length, 0)}`);
