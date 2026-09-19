/**
 * DPS-END harness: run the Endaxis simulator headlessly on a timeline project JSON,
 * replicating the app's loadout/armory data preparation.
 *
 * Usage: npx vite-node dpsend-harness.ts <project.json> <out.json>
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { compileEndaxisScenario } from './src/simulation/compileEndaxisScenario';
import { simulate } from './src/simulation/simulator';
import { deserializeProjectData } from './src/utils/timeSerialization';
import {
  buildEffectById,
  collectEffects,
  collectTriggerEffects,
  getEffectiveOperator,
  resolveStatAttributes,
} from './src/data/collect';
import { resolveEffectValueStatic } from './src/simulation/events/effectDispatch';
import { getBaseStatValues } from './src/data/stats/baseValues';
import { isEnemyEffect, type Effect } from './src/data/types';
import {
  getOperator as getOperatorSheet,
  getEnemy,
  resolveOperatorSlug,
  resolveWeaponSlug,
  resolveGearPieceSlug,
} from './src/data';
import { patchCombatSkills } from './src/data/collect';
import { getTeamStatus } from './src/data/team-status';
import { createDefaultStats } from './src/simulation/defaultActorStats';
import { setLocale } from './src/i18n';
import zhOperators from './src/i18n/game-locales/zh/operators.json';
import { buildNativeData } from './dpsend-native';
import { projectSpSeries } from './src/simulation/projection/projectSpSeries';

setLocale('zhCN');
(globalThis as any).__dpsendCollectEffects = collectEffects;
(globalThis as any).__dpsendGetEffectiveOperator = getEffectiveOperator;
(globalThis as any).__dpsendCollectTriggers = collectTriggerEffects;
(globalThis as any).__dpsendZhOperators = zhOperators;

type AnyRec = Record<string, any>;

const TRACK_GEAR_SLOTS = [
  { slotKey: 'armor', idKey: 'equipArmorId', instanceKey: 'equipArmorInstanceId', teamKey: 'armor' },
  { slotKey: 'gloves', idKey: 'equipGlovesId', instanceKey: 'equipGlovesInstanceId', teamKey: 'gloves' },
  { slotKey: 'accessory1', idKey: 'equipAccessory1Id', instanceKey: 'equipAccessory1InstanceId', teamKey: 'kit1' },
  { slotKey: 'accessory2', idKey: 'equipAccessory2Id', instanceKey: 'equipAccessory2InstanceId', teamKey: 'kit2' },
];

interface TrackMeta {
  slotIndex: number;
  operatorSlug: string;
  class: string | null;
  element: string | null;
  mainAttribute: string | null;
  subAttribute: string | null;
}

type CollectRuntimeEffect = AnyRec;

function resolveInitialEffectTargetTrackIds(
  effect: CollectRuntimeEffect,
  sourceSlotIndex: number,
  slotTrackIds: (string | null)[],
  trackMetaById: Map<string, TrackMeta>,
): string[] {
  const sourceTrackId = slotTrackIds[sourceSlotIndex] || null;
  const rawTarget = effect?.target;
  const targetObj = typeof rawTarget === 'object' && rawTarget ? rawTarget : null;
  const scope = typeof rawTarget === 'string' ? rawTarget : targetObj?.scope;
  const allowedClasses = Array.isArray(targetObj?.classes) ? targetObj.classes : null;
  const allowedElements = Array.isArray(targetObj?.elements) ? targetObj.elements : null;

  if (scope === 'enemy') return ['boss'];
  if (!sourceTrackId) return [];

  const allTrackIds = [...trackMetaById.keys()];
  const sourceElement = trackMetaById.get(sourceTrackId)?.element || null;

  const scoped = (() => {
    switch (scope) {
      case 'team':
        return allTrackIds;
      case 'teamExcludeSelf':
        return allTrackIds.filter(trackId => trackId !== sourceTrackId);
      case 'teamExcludeSameElement':
        return allTrackIds.filter(trackId => {
          if (trackId === sourceTrackId) return false;
          return trackMetaById.get(trackId)?.element !== sourceElement;
        });
      case 'statusRecipients':
      case 'statusRecipientsExcludeSelf':
        return [];
      default:
        return [sourceTrackId];
    }
  })();

  return scoped.filter(trackId => {
    const meta = trackMetaById.get(trackId);
    if (allowedClasses?.length && !(meta?.class && allowedClasses.includes(meta.class))) return false;
    if (allowedElements?.length && !(meta?.element && allowedElements.includes(meta.element)))
      return false;
    return true;
  });
}

function buildInitialRuntimeEffectsFromCollected(
  collectedEffects: AnyRec[],
  armory: {
    slotTrackIds: (string | null)[];
    trackMetaById: Map<string, TrackMeta>;
  },
  actorStatsByTrack: Map<string, AnyRec>,
): AnyRec[] {
  const ENEMY_STAT_MODIFIERS = new Set(['susceptibility', 'increasedDmgTaken', 'resistanceShred']);
  return collectedEffects.flatMap(ce => {
    const effect = ce?.effect;
    if (!effect || effect.kind !== 'status' || effect.condition || !effect.stat) return [];
    const rawTarget = effect.target;
    const scope = typeof rawTarget === 'string' ? rawTarget : rawTarget?.scope;
    if (scope === 'enemy') return [];
    if (effect.stat?.modifier && ENEMY_STAT_MODIFIERS.has(effect.stat.modifier)) return [];
    const sourceActorId = armory.slotTrackIds[ce.sourceSlotIndex] || null;
    if (!sourceActorId) return [];
    const value = resolveEffectValueStatic(
      effect as AnyRec,
      actorStatsByTrack.get(sourceActorId) as AnyRec,
    );
    const runtimeEffect = { ...effect, hide: true };
    return resolveInitialEffectTargetTrackIds(effect, ce.sourceSlotIndex, armory.slotTrackIds, armory.trackMetaById)
      .filter(targetId => targetId !== 'boss')
      .map(targetId => {
        const targetMeta = armory.trackMetaById.get(targetId);
        const resolvedStat = resolveStatAttributes(
          effect.stat as AnyRec,
          targetMeta?.mainAttribute as AnyRec,
          targetMeta?.subAttribute as AnyRec,
        );
        return {
          targetTrackId: targetId,
          id: effect.id,
          stat: resolvedStat,
          value,
          sourceId: sourceActorId,
          effect: { ...runtimeEffect, stat: resolvedStat },
          stacks: effect.stacks,
          maxStacks: effect.maxStacks,
          stackStrategy: effect.stackStrategy,
          external: effect.external,
        };
      });
  });
}

function buildConditionalPassiveTriggerEffectsFromCollected(
  collectedEffects: AnyRec[],
  armory: { slotTrackIds: (string | null)[]; trackMetaById: Map<string, TrackMeta> },
): AnyRec[] {
  const out: AnyRec[] = [];
  collectedEffects.forEach(ce => {
    const effect = ce?.effect;
    if (!effect || effect.kind !== 'status' || !effect.condition) return;
    if (Array.isArray(effect.condition)) return;

    let cond = effect.condition as AnyRec;
    if (cond.kind === 'enemyStaggered') cond = { kind: 'enemyStatus', status: 'staggered' };
    if (cond.kind !== 'operatorStatus' && cond.kind !== 'enemyStatus') return;

    const sourceTrackId = armory.slotTrackIds[ce.sourceSlotIndex] || null;
    if (!sourceTrackId) return;

    const isEnemyTarget = isEnemyEffect(effect as unknown as Effect);
    const idempotencyCondition = isEnemyTarget
      ? { kind: 'not', condition: { kind: 'enemyStatus', status: effect.id } }
      : { kind: 'not', condition: { kind: 'operatorStatus', status: effect.id } };

    const target = cond.kind === 'operatorStatus' ? 'self' : 'enemy';
    const isEnemyStatus = cond.kind === 'enemyStatus';
    const armedEffect =
      isEnemyStatus &&
      (effect.target === 'self' || effect.target === undefined ||
        (typeof effect.target === 'object' && effect.target?.scope === 'self'))
        ? { ...effect, target: 'owner' as const, duration: 999, condition: idempotencyCondition }
        : { ...effect, duration: 999, condition: idempotencyCondition };
    out.push({
      triggerEffect: {
        trigger: {
          kind: 'onStatusApplied',
          status: cond.status,
          target,
          ...(isEnemyStatus ? { triggerScope: 'global' } : {}),
        },
        effects: [armedEffect],
      },
      sourceSlotIndex: ce.sourceSlotIndex,
      sourceOperatorSlug: ce.sourceOperatorSlug,
      sourceTrackId,
      stacksConstraint: cond.stacks,
    });

    const removeCondition = {
      kind: 'not',
      condition: { kind: cond.kind, status: cond.status, ...(cond.stacks ? { stacks: cond.stacks } : {}) },
    };
    const isTeamScoped =
      effect.target === 'team' ||
      effect.target === 'teamExcludeSelf' ||
      effect.target === 'teamExcludeSameElement' ||
      (typeof effect.target === 'object' &&
        ['team', 'teamExcludeSelf', 'teamExcludeSameElement'].includes(effect.target?.scope));
    const removeTarget = isEnemyTarget
      ? 'enemy'
      : isTeamScoped
        ? 'self'
        : effect.target === 'owner'
          ? 'owner'
          : 'self';
    out.push({
      triggerEffect: {
        trigger: {
          kind: 'onStatusConsumed',
          status: cond.status,
          target: removeTarget,
          ...(isEnemyStatus ? { triggerScope: 'global' } : {}),
        },
        effects: [{ kind: 'consume', operatorStatus: effect.id }],
      },
      sourceSlotIndex: ce.sourceSlotIndex,
      sourceOperatorSlug: ce.sourceOperatorSlug,
      sourceTrackId,
    });
    if (isEnemyStatus) {
      out.push({
        triggerEffect: {
          trigger: {
            kind: 'onStatusExpire',
            status: cond.status,
            target: 'enemy',
            triggerScope: 'global',
          },
          effects: [{ kind: 'consume', operatorStatus: effect.id }],
        },
        sourceSlotIndex: ce.sourceSlotIndex,
        sourceOperatorSlug: ce.sourceOperatorSlug,
        sourceTrackId,
      });
    }
  });
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const inPath = args[0];
  const outPath = args[1] ?? 'dpsend_sim_out.json';
  const rawProject: AnyRec = JSON.parse(readFileSync(inPath, 'utf-8'));
  let project: AnyRec;
  let nativeEnemyName: string | null = null;
  if (rawProject.__native) {
    const built = buildNativeData(rawProject.__native);
    project = {
      name: built.scenarioName,
      scenarioList: [{ id: 'native', name: built.scenarioName, data: built.data }],
      activeScenarioId: 'native',
      activeEnemyId: built.activeEnemyId,
    };
    if (rawProject.__panelOverrides) project.__panelOverrides = rawProject.__panelOverrides;
    nativeEnemyName = built.enemyName;
  } else {
    project = deserializeProjectData(rawProject);
    if (rawProject.__recomputeMultipliers) project.__recomputeMultipliers = true;
  }
  const sc: AnyRec =
    (project.scenarioList ?? []).find((s: AnyRec) => s.id === project.activeScenarioId) ??
    project.scenarioList?.[0];
  if (!sc) throw new Error('scenarioList is empty');
  const data: AnyRec = sc.data ?? {};

  // ── instance lookups from the project ──
  const opById = new Map<string, AnyRec>((data.operators ?? []).map((o: AnyRec) => [o.id, o]));
  const wpById = new Map<string, AnyRec>((data.weapons ?? []).map((w: AnyRec) => [w.id, w]));
  const gearById = new Map<string, AnyRec>((data.gears ?? []).map((g: AnyRec) => [g.id, g]));

  // ── armory context ──
  const teamSlots: AnyRec[] = [];
  const operatorInstances: AnyRec[] = [];
  const weaponInstances: AnyRec[] = [];
  const gearInstances: AnyRec[] = [];
  const slotTrackIds: (string | null)[] = [];
  const trackMetaById = new Map<string, TrackMeta>();
  const armory = { slotTrackIds, trackMetaById };

  const tracks: AnyRec[] = data.tracks ?? [];
  // 练度覆盖后按新技能等级重解倍率（server 在存在干员覆盖时置位 __recomputeMultipliers）。
  // 只改 multiplier 数值，保留时序/效果/条件；结构对不上（段数不匹配）时保守跳过该动作。
  if (project.__recomputeMultipliers) {
    for (const track of tracks) {
      const opInst0 = track.operatorInstanceId ? opById.get(track.operatorInstanceId) : null;
      if (!opInst0) continue;
      const sheet0 = getOperatorSheet(opInst0.operatorSlug);
      if (!sheet0) continue;
      const flatSkills = patchCombatSkills(sheet0, {
        talentStates: opInst0.talentStates ?? {},
        potential: opInst0.potential ?? 0,
        skillLevels: opInst0.skillLevels ?? {},
      } as AnyRec) as AnyRec;
      for (const action of track.actions ?? []) {
        const key = action.skillKey || action.sourceSkillKey || action.skillId;
        const skill = key ? flatSkills[key] : null;
        if (!skill?.segments) continue;
        // 乘率表按技能等级索引（1..12 → 0..11）；subSkill 沿用父技能 levelKey
        const lvlKey = String(skill.levelKey ?? key ?? 'basicAttack');
        const lvl = Math.max(1, Math.min(12, Number(opInst0.skillLevels?.[lvlKey] ?? 12)));
        const lvlIdx = lvl - 1;
        // 动作可能只对应技能的某一段（普攻 1/2/3 分动作），attackSegmentIndex 为 1-based
        const segIdx = action.attackSegmentIndex ?? action.segmentIndex;
        const groups: AnyRec[] = [];
        if (segIdx != null && skill.segments[Number(segIdx) - 1]) {
          groups.push(...(skill.segments[Number(segIdx) - 1].damageGroups ?? []));
        } else {
          for (const seg of skill.segments) groups.push(...(seg.damageGroups ?? []));
        }
        const want: number[] = [];
        for (const g of groups) {
          const n = Math.max(1, (g.hits ?? []).length);
          const table = Array.isArray(g.multiplier) ? g.multiplier : [g.multiplier];
          const resolved = table[lvlIdx];
          if (resolved == null) continue;
          // split：整段倍率按命中数分摊；each：每段全额
          const per = g.multiplierMode === 'split' ? resolved / n : resolved;
          for (let k = 0; k < n; k++) want.push(per);
        }
        const have = (action.hits ?? []).filter((h: AnyRec) => h.multiplier != null);
        if (!want.length || want.length !== have.length) continue;
        let mi = 0;
        for (const h of action.hits ?? []) {
          if (h.multiplier != null) h.multiplier = want[mi++];
        }
      }
    }
  }
  for (let index = 0; index < Math.min(tracks.length, 4); index++) {
    const track = tracks[index];
    const opInst = track.operatorInstanceId ? opById.get(track.operatorInstanceId) : null;
    if (!opInst) {
      teamSlots.push({ operatorId: null, weaponId: null, gear: { armor: null, gloves: null, kit1: null, kit2: null } });
      slotTrackIds.push(null);
      continue;
    }
    const wpInst = track.weaponInstanceId ? wpById.get(track.weaponInstanceId) : null;
    const gear: AnyRec = { armor: null, gloves: null, kit1: null, kit2: null };
    for (const cfg of TRACK_GEAR_SLOTS) {
      const gid = track[cfg.instanceKey];
      const ginst = gid ? gearById.get(gid) : null;
      if (!ginst) continue;
      gear[cfg.teamKey!] = ginst.id;
      gearInstances.push(ginst);
    }
    teamSlots.push({ operatorId: opInst.id, weaponId: wpInst?.id || null, gear });
    slotTrackIds.push(track.id || null);
    const sheet = getOperatorSheet(opInst.operatorSlug);
    trackMetaById.set(track.id, {
      slotIndex: index,
      operatorSlug: opInst.operatorSlug,
      class: sheet?.class || null,
      element: sheet?.element || null,
      mainAttribute: sheet?.mainAttribute || null,
      subAttribute: sheet?.subAttribute || null,
    });
    operatorInstances.push(opInst);
    if (wpInst) weaponInstances.push(wpInst);
  }
  const team = { id: '_timeline_armory', name: '', slots: teamSlots };

  // ── base stats (level/trust-scaled sheet values) ──
  const baseStatsByTrack = new Map<string, AnyRec>();
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const opInst = track.operatorInstanceId ? opById.get(track.operatorInstanceId) : null;
    if (!opInst) continue;
    const wpInst = track.weaponInstanceId ? wpById.get(track.weaponInstanceId) : undefined;
    baseStatsByTrack.set(track.id, getBaseStatValues(opInst as AnyRec, wpInst as AnyRec | undefined));
  }
  // DPS-END：新版 Endaxis 导出轴的 track 是精简格式（无 stats 面板），改带
  // gaugeEfficiency / originiumArtsPower / linkCdReduction 三个独立字段。上游 UI 导入时
  // 由 stores/timeline/normalizers.ts 合成 stats 面板；回放路径不做同样合成的话，
  // 源石技艺强度=0（浮空/失衡期增伤全丢）、充能效率=0（终结技充不出来）。逐字段对齐上游。
  const DEFAULT_ACTOR_STATS: AnyRec = {
    primary_ability: 0, secondary_ability: 0, strength: 0, agility: 0, intellect: 0, will: 0,
    attack: 0, hp: 0, crit_rate: 0, blaze_dmg: 0, emag_dmg: 0, cold_dmg: 0, nature_dmg: 0,
    healing_effect: 0, physical_dmg: 0, arts_dmg: 0, originium_arts_power: 0,
    ult_charge_eff: 100, link_cd_reduction: 0, combo_cd_reduction: 0, combo_cd_reduction_flat: 0,
    ult_cd_reduction: 0, ult_cd_reduction_flat: 0, combo_cd_external_mult: 1, ult_cd_external_mult: 1,
  };
  for (const t of tracks) {
    const incoming = t.stats;
    const hasStats = incoming && typeof incoming === 'object' && Object.keys(incoming).length > 0;
    if (hasStats) {
      t.stats = { ...DEFAULT_ACTOR_STATS, ...(incoming as AnyRec) };
      continue;
    }
    const stats: AnyRec = { ...DEFAULT_ACTOR_STATS };
    const eff = Number((t as AnyRec).gaugeEfficiency);
    if (Number.isFinite(eff)) stats.ult_charge_eff = eff;
    const link = Number((t as AnyRec).linkCdReduction);
    if (Number.isFinite(link)) stats.link_cd_reduction = link;
    const arts = Number((t as AnyRec).originiumArtsPower);
    if (Number.isFinite(arts)) stats.originium_arts_power = arts;
    t.stats = stats;
  }
  const actorStatsByTrack = new Map<string, AnyRec>();
  for (const t of tracks) {
    const st = t.stats ?? {};
    actorStatsByTrack.set(t.id, st);
  }

  // ── effects & triggers ──
  const collected = collectEffects(team as AnyRec, operatorInstances as AnyRec[], weaponInstances as AnyRec[], gearInstances as AnyRec[]);
  const effectById = buildEffectById(collected as AnyRec[]);
  const collectedTriggers = collectTriggerEffects(team as AnyRec, operatorInstances as AnyRec[], weaponInstances as AnyRec[], gearInstances as AnyRec[], effectById as AnyRec);
  const conditionalPassiveTriggers = buildConditionalPassiveTriggerEffectsFromCollected(collected as AnyRec[], armory);
  // DPS-END：上游条件被动的解除触发过激——onStatusConsumed 在条件状态被消耗任意一层时
  // 就解除增益，即使层数还有剩（提弗洛斯「猎物清点」×1.6 因此只打中每轮第一发空中射击）。
  // 上游注释自己写明意图是「还有剩就不该解除」，只是解除条件漏了未声明层数时的检查。
  // 这里统一补上「至少还剩 1 层」：条件状态耗尽才解除，对齐天赋语义。
  for (const ct of conditionalPassiveTriggers as AnyRec[]) {
    const te = ct?.triggerEffect as AnyRec | undefined;
    const trigKind = te?.trigger?.kind;
    if (trigKind !== 'onStatusConsumed' && trigKind !== 'onStatusExpire') continue;
    // 解除条件的内层状态 = 触发器监视的那个条件状态
    const trigStatus = te?.trigger?.status;
    const trigTarget = te?.trigger?.target === 'enemy' ? 'enemyStatus' : 'operatorStatus';
    for (const fx of (te?.effects ?? []) as AnyRec[]) {
      if (fx?.kind !== 'consume') continue;
      if (fx?.condition) {
        const inner = (fx.condition as AnyRec).condition as AnyRec | undefined;
        if ((inner?.kind === 'operatorStatus' || inner?.kind === 'enemyStatus') && !inner.stacks) {
          inner.stacks = { compare: 'atLeast', count: 1 };
        }
        continue;
      }
      // 上游构造的解除 consume 可能压根没有 condition：无条件解除 = 消耗任意一层就
      // 解除增益。补成「条件状态还剩 ≥1 层就保留，耗尽才解除」。
      if (trigStatus) {
        fx.condition = {
          kind: 'not',
          condition: {
            kind: trigTarget,
            status: trigStatus,
            stacks: { compare: 'atLeast', count: 1 },
          },
        };
      }
    }
  }
  if (process.env.DPSEND_DEBUG_TRIGGERS) {
    const ty = (conditionalPassiveTriggers as AnyRec[]).filter(t => (t?.triggerEffect as AnyRec)?.effects?.some?.((f: AnyRec) => JSON.stringify(f)?.includes('talent0')));
    console.error('DEBUG triggers:', JSON.stringify(ty, null, 1).slice(0, 3000));
  }
  const allTriggers = [...collectedTriggers, ...conditionalPassiveTriggers].map((cte: AnyRec) => ({
    ...cte,
    sourceTrackId:
      cte?.sourceTrackId || tracks[cte?.sourceSlotIndex]?.id || cte?.sourceOperatorSlug || null,
  }));
  const runtimeInitialEffects = buildInitialRuntimeEffectsFromCollected(collected as AnyRec[], armory, actorStatsByTrack);

  // ── 面板修正覆盖（在模拟器已算出的面板之上额外增加的暴击率/暴伤，单位为百分点） ──
  // 语义是"增量"而非"绝对值"：模拟器自身的装备/武器/被动已经在基础属性里生效，
  // 这里只补它漏算的部分，避免把同一份暴击来源重复计算。
  const panelOverrides: AnyRec[] = project.__panelOverrides ?? [];
  const calibration = rawProject.__native?.calibration ?? {};
  // slug 为 "all" 时批量作用于全队，方便只想整体微调面板的场景。
  for (const [slug, vals] of Object.entries(calibration)) {
    const v = vals as AnyRec;
    const targets = slug === 'all' ? [...trackMetaById.keys()] : [slug];
    for (const track of targets) {
      if (!trackMetaById.has(track)) continue;
      if (v.critRate !== undefined) {
        panelOverrides.push({ track, stat: 'critRate', value: Number(v.critRate) });
      }
      if (v.critDmg !== undefined) {
        panelOverrides.push({ track, stat: 'critDmg', value: Number(v.critDmg) });
      }
    }
  }
  for (const ov of panelOverrides) {
    if (!ov?.track || !ov?.stat || ov.value === undefined) continue;
    if (!trackMetaById.has(ov.track)) continue;
    runtimeInitialEffects.push({
      targetTrackId: ov.track,
      id: `custom-${ov.stat}`,
      stat: { modifier: ov.stat },
      value: Number(ov.value),
      sourceId: ov.track,
      effect: { kind: 'status', id: `custom-${ov.stat}`, target: { scope: 'self' } },
      stacks: 1,
      maxStacks: 1,
    });
  }

  // tracks for compilation: replace baseStats with sheet-derived values, attach runtime triggers
  const compiledTracks = tracks.map(track => ({
    ...track,
    baseStats: baseStatsByTrack.get(track.id) ?? track.baseStats ?? null,
    triggerEffects: allTriggers,
  }));

  const compiled = compileEndaxisScenario({
    scenarioData: { ...data, connections: data.connections ?? [] },
    tracks: compiledTracks,
    characterRoster: [],
    systemConstants: data.systemConstants ?? {},
    prepDuration: data.prepDuration ?? 0,
    activeEnemyId: project.activeEnemyId ?? null,
    runtimeInitialEffects: runtimeInitialEffects as unknown as any[],
    lmdiAttributionMode: 'applier',
  });
  if (!compiled) throw new Error('compileEndaxisScenario failed');

  // 显式防御覆盖：排轴/GUI 明确给出 defense 时，优先于敌人模板自带的 def
  // （compileEndaxisScenario 里模板 sheet 的 def 恒定优先，会导致 GUI 防御字段失效）
  const explicitDefense = (data.systemConstants as AnyRec | undefined)?.defense;
  if (explicitDefense !== undefined && explicitDefense !== null) {
    compiled.enemyDef = Number(explicitDefense);
  }
  // 敌人配置指纹：写进输出，任何"算出来的数对不上"都可以直接核对当时用的敌人设置
  const rawSysc = (data.systemConstants ?? {}) as AnyRec;
  compiled.__enemyFingerprint = {
    id: project.activeEnemyId ?? 'custom',
    hp: rawSysc.enemyHp ?? null,
    resistance: rawSysc.resistance ?? null,
    defense: compiled.enemyDef,
    maxStagger: rawSysc.maxStagger ?? null,
    staggerBreakDuration: rawSysc.staggerBreakDuration ?? null,
    executionRecovery: rawSysc.executionRecovery ?? null,
    superArmor: rawSysc.superArmor ?? null,
    panelOverrides: (project.__panelOverrides ?? []).length,
  };

  const result = simulate(
    compiled.timeline,
    compiled.teamConfig,
    compiled.enemyConfig,
    compiled.actors,
    compiled.triggerRegistry,
    compiled.consumedStacksWriteKeys,
    {
      initialEffects: compiled.initialEffects,
      baseStatsByTrack: compiled.baseStatsByTrack,
      enemyDef: compiled.enemyDef,
      endlineTime: compiled.endlineTime,
      lmdiAttributionMode: 'applier',
    },
  );

  const simLog: any[] = result.simLog ?? [];
  const actionNameById = new Map<string, string>();
  for (const track of tracks) {
    for (const a of track.actions ?? []) {
      if (a.instanceId) actionNameById.set(a.instanceId, a.name ?? a.type);
    }
  }

  const hits: AnyRec[] = [];
  for (const e of simLog) {
    if (e.type !== 'DAMAGE_HIT') continue;
    const hd = e.payload?.hitData ?? {};
    const b = hd._damageBreakdown ?? {};
    hits.push({
      t: e.time,
      src: e.payload?.sourceId,
      act: e.payload?.actionId,
      actionName: actionNameById.get(e.payload?.actionId) ?? hd.triggeredBy,
      elem: hd._reactionMeta?.element ?? hd.element,
      st: hd.skillType,
      sid: hd.skillId,
      mult: hd.multiplier,
      resolvedMult: b.multiplier,
      exp: hd._expectedDamage,
      nc: b.nonCritDamage,
      crit: b.critDamage,
      atk: b.attack,
      base: b.base,
      bonus: b.dmgBonusMult,
      amp: b.ampMult,
      susc: b.susceptMult,
      taken: b.dmgTakenMult,
      def: b.defMult,
      res: b.resMult,
      shred: b.resistanceShred,
      enemyRes: b.enemyResistance,
      resIgnore: b.resistanceIgnore,
      stagger: b.staggerMult,
      fin: b.finisherMult,
      critRate: b.critRate,
      critDmg: b.critDmg,
      critMult: b.critMult,
      link: b.linkMult,
      linkStacks: b.linkStacks,
      direct: b.directMultiplier,
      dmgSources: b.dmgBonusSources,
      ampSources: b.ampBonusSources,
      suscSources: b.susceptibilitySources,
      takenSources: b.increasedDmgTakenSources,
      shredSources: b.resistanceShredSources,
      atkSources: b.atkDetail?.atkPercentSources,
      flatAtk: b.atkDetail?.flatAtk,
      baseAtk: b.atkDetail,
      hitIndex: hd._hitIndex,
      reaction: hd._reactionMeta?.reactionType,
      reactionLevel: b.levelCoefficient,
      reactionArts: b.artsIntensityMult,
      reactionEffect: b.effectivenessMult,
      lmdiSelf: hd._lmdiSelf,
      lmdiExt: hd._lmdiExternal,
      triggeredBy: hd.triggeredBy,
      enemyState: hd._enemyState,
    });
  }

  const startlineSec = Number(data.simulationStartline ?? data.prepDuration ?? 0);
  const damaging = hits.filter(h => (h.exp ?? 0) > 0 && h.t >= startlineSec);
  const totalDamage = damaging.reduce((s, h) => s + (h.exp ?? 0), 0);
  const lastTime = damaging.reduce((m, h) => Math.max(m, h.t), 0);
  const firstAction = Math.min(...tracks.flatMap((t: AnyRec) => (t.actions ?? []).map((a: AnyRec) => a.startTime)));
  const rotationTime = lastTime - startlineSec;
  const spanTime = lastTime - firstAction;

  const lmdi = new Map<string, { dmg: number; buff: number }>();
  for (const h of damaging) {
    const d = lmdi.get(h.src) ?? { dmg: 0, buff: 0 };
    d.dmg += h.lmdiSelf ?? h.exp ?? 0;
    lmdi.set(h.src, d);
    for (const [src, v] of Object.entries(h.lmdiExt ?? {})) {
      const d2 = lmdi.get(src) ?? { dmg: 0, buff: 0 };
      d2.buff += Number(v);
      lmdi.set(src, d2);
    }
  }

  const operatorLog = (result.operatorLog ?? [])
    .filter((e: AnyRec) => e.type === 'OPERATOR_EFFECT_APPLY')
    .map((e: AnyRec) => ({
      t: e.time, target: e.targetTrackId, id: e.id,
      stat: e.stat?.modifier, value: e.value, stacks: e.stacks,
      cumulative: e.cumulativeStacks, source: e.sourceId,
      expires: Number.isFinite(e.expiresAt) ? e.expiresAt : null,
    }));
  const enemyLog = (result.enemyLog ?? [])
    .filter((e: AnyRec) => ['INFLICTION_APPLY', 'DEBUFF_APPLY', 'CORROSION_TICK', 'STAGGER', 'ENEMY_EFFECT_APPLY', 'ENEMY_EFFECT_EXPIRE'].includes(e.type))
    .map((e: AnyRec) => ({
      t: e.time, type: e.type, id: e.id ?? e.payload?.debuffType ?? e.payload?.kind,
      element: e.element ?? e.payload?.element,
      value: e.value ?? e.payload?.resShred, stacks: e.stacks ?? e.payload?.stagger,
      level: e.level ?? e.payload?.level,
      source: e.sourceId ?? e.payload?.sourceId,
      isBroken: e.payload?.isBroken, breakEnd: e.payload?.breakEndTime,
    }));

  const spLog = simLog
    .filter(e => e.type === 'SP_CHANGE' || e.type === 'ULT_ENERGY_CHANGE')
    .map(e => ({
      t: e.time, track: e.payload?.actorId, kind: e.type,
      sp: e.payload?.spChange ?? (e.type === 'SP_CHANGE' ? e.payload?.change : undefined),
      gauge: e.type === 'ULT_ENERGY_CHANGE' ? e.payload?.change : undefined,
      reason: e.payload?.reason, source: e.payload?.sourceId,
    }));

  const statusLog = simLog
    .filter(e => !['DAMAGE_HIT', 'ACTION_START', 'ACTION_END', 'SP_CHANGE', 'ULT_ENERGY_CHANGE'].includes(e.type))
    .map(e => ({ type: e.type, t: e.time,
                 actor: e.payload?.actorId, actionId: e.payload?.actionId,
                 amount: e.payload?.amount, stagger: e.payload?.stagger,
                 isBroken: e.payload?.isBroken, breakEnd: e.payload?.breakEndTime,
                 nodeEnd: e.payload?.nodeEndTime, nodeIndex: e.payload?.nodeReachedIndex,
                 pause: e.payload?.duration }))
    .map(e => ({
      t: e.time,
      target: e.targetTrackId ?? e.payload?.targetId,
      id: e.id ?? e.payload?.id,
      stat: e.stat?.modifier ?? e.payload?.stat?.modifier,
      value: e.value ?? e.payload?.value,
      stacks: e.stacks ?? e.payload?.stacks,
      source: e.sourceId ?? e.payload?.sourceId,
      element: e.element ?? e.payload?.element,
      type: e.type,
    }));

  const enemyHp = Number(data.systemConstants?.enemyHp ?? 0) || 0;
  const out = {
    meta: {
      source: inPath,
      scenario: sc.name,
      activeEnemyId: project.activeEnemyId,
      enemyName: nativeEnemyName
        ?? (project.activeEnemyId && project.activeEnemyId !== 'custom'
          ? getEnemy(project.activeEnemyId)?.name ?? project.activeEnemyId
          : '训练木桩（自定义）'),
      generatedAt: new Date().toISOString(),
      simulator: 'Endaxis (github.com/Lieyuan621/Endaxis)',
    },
    summary: {
      totalDamage: Math.round(totalDamage),
      lastDamageTime: lastTime,
      startlineSec,
      rotationTime,
      firstActionTime: firstAction,
      spanTime,
      dps: rotationTime > 0 ? totalDamage / rotationTime : 0,
      spanDps: spanTime > 0 ? totalDamage / spanTime : 0,
      hitCount: damaging.length,
      enemyHpLeft: enemyHp > 0 ? enemyHp - totalDamage : undefined,
      lmdi: [...lmdi.entries()].map(([track, v]) => ({ track, ...v })),
      enemyConfig: (compiled as AnyRec).__enemyFingerprint ?? null,
    },
    hits,
    spLog,
    // 官方 SP 序列投影：精确建模 自然恢复(spRegenRate)/上限(maxSp)/恢复暂停/欠费返还池
    spSeries: projectSpSeries(
      simLog,
      {
        team: {
          maxSp: compiled.teamConfig?.maxSp ?? 300,
          spRegenRate: compiled.teamConfig?.spRegenRate ?? 0,
          sp: compiled.teamConfig?.initialSp ?? 0,
        },
      } as AnyRec,
      lastTime,
    ),
    spRegenRate: compiled.teamConfig?.spRegenRate ?? 0,
    maxSp: compiled.teamConfig?.maxSp ?? 300,
    statusLog,
    operatorLog,
    enemyLog,
  };
  writeFileSync(outPath, JSON.stringify(out));
  console.log(
    `total=${Math.round(totalDamage)} last=${lastTime.toFixed(2)}s rotation=${rotationTime.toFixed(2)}s dps=${(totalDamage / rotationTime).toFixed(1)} hits=${damaging.length} lmdi=${[...lmdi.entries()].map(([k, v]) => `${k}:${Math.round(v.dmg)}+${Math.round(v.buff)}`).join(', ')}`,
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
