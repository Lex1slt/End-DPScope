/**
 * DPS-END 原生配置构建器：不依赖 Endaxis 导出文件，
 * 直接从 干员练度+武器+装备+技能顺序 构建可编译的排轴数据。
 *
 * 复用 Endaxis 自身的管线：
 *   patchCombatSkills（潜能/天赋补丁）→ resolveHitsFromSheet（按技能等级解析hit）
 *   → getTeamStatus（面板装配投影）→ collectEffects/collectTriggerEffects（增益与触发器）
 */
import {
  patchCombatSkills,
  buildEffectById,
} from './src/data/collect';
import { resolveHitsFromSheet, extractRawEntries } from './src/stores/timeline/resolveHits';
import {
  getOperator as getOperatorSheet,
  getWeapon as getWeaponSheet,
  getGearPiece as getGearPieceSheet,
  resolveOperatorSlug,
  resolveWeaponSlug,
  resolveGearPieceSlug,
  getEnemy,
} from './src/data';
import { getBaseStatValues } from './src/data/stats/baseValues';
import { createDefaultStats } from './src/simulation/defaultActorStats';
import { getTeamStatus } from './src/data/team-status';

type AnyRec = Record<string, any>;

const FPS = 60;
/** 对齐到帧边界，但保持秒为单位（与反序列化后的导出格式一致） */
const snapSec = (s: number) => Math.round(Number(s) * FPS) / FPS;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const BASIC_SEG_NAMES = ['普攻1', '普攻2', '普攻3', '重击'];
const GENERIC_NAMES: Record<string, string> = {
  basicAttack: '普攻', battleSkill: '战技', comboSkill: '连携',
  ultimate: '终结技', finisher: '处决', dive: '下落攻击',
};

function parseGear(spec: any): { gearPieceId: string; artificingLevels: number[] } {
  if (typeof spec === 'string') {
    const [piece, arts] = spec.split('@');
    const levels = arts
      ? arts.split(',').map(v => Number(v) || 0)
      : [3, 3, 3, 3];
    return { gearPieceId: piece, artificingLevels: levels };
  }
  return {
    gearPieceId: String(spec.piece ?? spec),
    artificingLevels: Array.isArray(spec.artificing) ? spec.artificing.map(Number) : [3, 3, 3, 3],
  };
}

/** 把练度/装备/轴配置编译成 Endaxis 场景数据（data 对象）。 */
export function buildNativeData(nv: AnyRec): AnyRec {
  const durationSec = Number(nv.durationSec ?? 120);
  const prepSec = Number(nv.prepSec ?? 5);
  const tracks: AnyRec[] = [];
  const operators: AnyRec[] = [];
  const weapons: AnyRec[] = [];
  const gears: AnyRec[] = [];
  const opInsts: AnyRec[] = [];
  const wpInsts: AnyRec[] = [];
  const gearInsts: AnyRec[] = [];
  const teamSlots: AnyRec[] = [];
  const slotTrackIds: (string | null)[] = [];
  const trackMetaById = new Map<string, TrackMeta>();
  interface TrackMeta {
    slotIndex: number;
    operatorSlug: string;
    class: string | null;
    element: string | null;
    mainAttribute: string | null;
    subAttribute: string | null;
  }

  (nv.operators ?? []).forEach((cfg: AnyRec, index: number) => {
    const slug = resolveOperatorSlug(cfg.operator ?? cfg.slug ?? '') || String(cfg.operator);
    const baseSheet = getOperatorSheet(slug);
    if (!baseSheet)
      throw new Error(`未知干员: ${cfg.operator}（计算核心 Endaxis 上游尚未收录该干员的数据，`
        + `请关注 Endaxis 更新后在 DPS-END 中执行同步）`);
    const opInstId = `inst_${slug}`;
    const skills = cfg.skills ?? {};
    const skillLevels: AnyRec = {
      basicAttack: clamp(Number(skills.basicAttack ?? 10), 1, 12),
      battleSkill: clamp(Number(skills.battleSkill ?? 10), 1, 12),
      comboSkill: clamp(Number(skills.comboSkill ?? 10), 1, 12),
      ultimate: clamp(Number(skills.ultimate ?? 10), 1, 12),
    };
    const opInst: AnyRec = {
      id: opInstId,
      operatorSlug: slug,
      level: Number(cfg.level ?? 90),
      promoted: cfg.promoted ?? true,
      potential: Number(cfg.potential ?? 0),
      skillLevels,
      talentStates: cfg.talents ?? {},
      trustLevel: Number(cfg.trust ?? 0),
    };
    const slot = { operatorId: opInst.id, weaponId: null,
                   gear: { armor: null, gloves: null, kit1: null, kit2: null } };
    const sheet = (globalThis as any).__dpsendGetEffectiveOperator(
      opInst, [], [], slot) ?? baseSheet;
    operators.push(opInst);
    opInsts.push(opInst);

    let wpInst: AnyRec | undefined;
    if (cfg.weapon) {
      const wslug = resolveWeaponSlug(
        typeof cfg.weapon === 'string' ? cfg.weapon : cfg.weapon.slug) || cfg.weapon.slug;
      wpInst = {
        id: `w_${slug}`,
        weaponSlug: wslug,
        level: Number(cfg.weapon?.level ?? 90),
        tuned: cfg.weapon?.tuned ?? true,
        potential: Number(cfg.weapon?.potential ?? 0),
        skill1Level: clamp(Number(cfg.weapon?.affix1 ?? 10), 1, 12),
        skill2Level: clamp(Number(cfg.weapon?.affix2 ?? 10), 1, 12),
        skill3Level: clamp(Number(cfg.weapon?.talent ?? 4), 1, 12),
      };
      weapons.push(wpInst);
      wpInsts.push(wpInst);
    }

    const gearMap: AnyRec = { armor: null, gloves: null, kit1: null, kit2: null };
    const slotKeys = ['armor', 'gloves', 'kit1', 'kit2'] as const;
    const gearSpecs = Array.isArray(cfg.gears) ? cfg.gears : null;
    slotKeys.forEach((slotKey, gi) => {
      const spec = gearSpecs
        ? (gearSpecs[gi] ?? (gearSpecs as AnyRec)[slotKey])
        : (cfg.gears ?? {})[slotKey];
      if (!spec) return;
      const g = parseGear(spec);
      const gslug = resolveGearPieceSlug(g.gearPieceId) || g.gearPieceId;
      const ginst = {
        id: `g_${slug}_${slotKey}`,
        gearPieceId: gslug,
        artificingLevels: g.artificingLevels,
      };
      gears.push(ginst);
      gearInsts.push(ginst);
      gearMap[slotKey] = ginst.id;
    });
    teamSlots.push({ operatorId: opInst.id, weaponId: wpInst?.id ?? null, gear: gearMap });
    slotTrackIds.push(slug);

    trackMetaById.set(slug, {
      slotIndex: index,
      operatorSlug: slug,
      class: sheet.class || null,
      element: sheet.element || null,
      mainAttribute: sheet.mainAttribute || null,
      subAttribute: sheet.subAttribute || null,
    });

    // ── 轴 → 动作 ──
    const flatSkills = patchCombatSkills(sheet, {
      talentStates: opInst.talentStates,
      potential: opInst.potential,
    } as AnyRec) as AnyRec;
    const zhNames = getZhSkillNames(slug);
    const actions: AnyRec[] = [];
    let castCounter = 0;

    const makeAction = (
      t: number, skillKey: string, seg: AnyRec, hits: AnyRec[],
      opts: { name?: string; seq?: number; total?: number; cooldownSec?: number;
              spCost?: number; gaugeCost?: number; animationSec?: number; castNo?: number;
              skillId?: string; enhancementSec?: number; effects?: AnyRec[] },
    ) => {
      const castNo = opts.castNo ?? 1;
      return {
        id: `nat_${slug}_${skillKey}_${castNo}`,
        instanceId: `nat_${slug}_${skillKey}_${castNo}`,
        type: skillKey,
        skillId: opts.skillId ?? skillKey,
        name: opts.name ?? GENERIC_NAMES[skillKey] ?? skillKey,
        startTime: snapSec(t),
        logicalStartTime: snapSec(t),
        duration: snapSec(Number(seg?.duration ?? 1)),
        cooldown: snapSec(Number(opts.cooldownSec ?? 0)),
        spCost: Number(opts.spCost ?? 0),
        spGain: 0,
        spGainKind: 'recover',
        element: (skillKey === 'basicAttack' || skillKey === 'finisher' || skillKey === 'dive'
          ? (skillKey === 'basicAttack' ? sheet.element : (sheet as AnyRec)[`${skillKey}Element`])
          : (flatSkills[skillKey]?.element ?? sheet.element)) || 'physical',
        gaugeCost: Number(opts.gaugeCost ?? 0),
        gaugeGain: 0,
        teamGaugeGain: 0,
        enhancementTime: snapSec(Number(opts.enhancementSec ?? 0)),
        triggerWindow: 0,
        animationTime: snapSec(Number(opts.animationSec ?? 0)),
        isDisabled: false,
        hits,
        ...(opts.effects ? { effects: opts.effects } : {}),
        ...(opts.seq ? { attackSequenceIndex: opts.seq, attackSequenceTotal: opts.total } : {}),
      };
    };

    for (const item of cfg.rotation ?? []) {
      const t = Number(item.t ?? 0);
      const skillKey = String(item.skill ?? 'battleSkill');
      castCounter += 1;
      const skill = flatSkills[skillKey];
      // 处决/下落攻击的倍率随普攻等级（levelKey: basicAttack）；
      // subSkills（如强化普攻）也继承父技能的 levelKey
      const levelKey = String(skill?.levelKey ?? skillKey);
      const effLevel = (skillKey === 'finisher' || skillKey === 'dive')
        ? skillLevels.basicAttack : (skillLevels[levelKey] ?? skillLevels[skillKey] ?? 10);
      const levelIndex = clamp(Number(effLevel) - 1, 0, 11);

      if (skillKey === 'basicAttack') {
        const segs: AnyRec[] = flatSkills.basicAttack?.segments ?? [];
        const only = item.segment;
        segs.forEach((seg: AnyRec, i: number) => {
          if (only && Number(only) !== i + 1) return;
          const hits = resolveHitsFromSheet(
            [], extractRawEntries({ segments: [seg] }, 0), levelIndex, { preserveCondition: true });
          const segName = (i === segs.length - 1 && segs.length > 1)
            ? '重击' : `普攻${i + 1}`;
          actions.push(makeAction(t, 'basicAttack', seg, hits, {
            name: segName,
            seq: i + 1, total: segs.length,
            castNo: castCounter * 10 + i + 1,
          }));
        });
        continue;
      }

      const seg = skill?.segments?.[0];
      if (!seg) throw new Error(`干员 ${slug} 没有技能 ${skillKey}`);
      const hits = resolveHitsFromSheet(
        [], extractRawEntries({ segments: [seg] }, 0), levelIndex, { preserveCondition: true });
      const isUlt = skillKey === 'ultimate';
      const isCombo = skillKey === 'comboSkill';
      const isBS = skillKey === 'battleSkill';
      // subSkills 展开后 type 继承父技能（如 enhancedBasicAttack → basicAttack），
      // 这样 skillTypes 过滤器和终结技增强窗口都能正确匹配
      const actType = String(skill.type ?? skillKey);
      actions.push(makeAction(t, actType, seg, hits, {
        name: GENERIC_NAMES[skillKey]
          ?? String(getZhSkillNames(slug)?.subSkills?.[skillKey] ?? skillKey),
        cooldownSec: isCombo
          ? (Number(skill.cooldown?.[levelIndex] ?? skill.cooldown ?? 0))
          : isUlt ? Number(skill.cooldown ?? 0) : 0,
        spCost: isBS ? Number(seg.spCost ?? 100) : 0,
        gaugeCost: isUlt ? Number(skill.ultimateEnergyCost ?? 0) : 0,
        animationSec: isUlt ? Number(skill.animationTime ?? 0) : 0,
        castNo: castCounter,
        skillId: skillKey,
        enhancementSec: isUlt ? Number(skill.enhancementTime ?? 0) : 0,
        ...(skill.effects ? { effects: skill.effects } : {}),
      }));

      // 终结技的 subSkills（如伊冯「强化普攻」：叠暴击率/满层暴伤/冻结追伤）在游戏里
      // 随终结技自动展开为一段连续攻击，这里按 动画结束时刻 自动补齐动作块
      if (isUlt) {
        const subs = (sheet.combatSkills as AnyRec)?.ultimate?.subSkills as AnyRec[] | undefined;
        for (const sub of subs ?? []) {
          const subKey = String(sub.id ?? sub.name ?? '');
          const subSkill = flatSkills[subKey];
          const subSeg = subSkill?.segments?.[0];
          if (!subKey || !subSkill || !subSeg) continue;
          castCounter += 1;
          const subLevel = clamp(
            Number(skillLevels[String(subSkill.levelKey ?? 'basicAttack')] ?? 10) - 1, 0, 11);
          const subHits = resolveHitsFromSheet(
            [], extractRawEntries({ segments: [subSeg] }, 0), subLevel, { preserveCondition: true });
          actions.push(makeAction(
            t + Number(skill.animationTime ?? 0),
            String(subSkill.type ?? sub.group ?? 'basicAttack'),
            subSeg, subHits, {
              name: String(getZhSkillNames(slug)?.subSkills?.[subKey] ?? subKey),
              castNo: castCounter,
              skillId: subKey,
              ...(subSkill.effects ? { effects: subSkill.effects } : {}),
            }));
        }
      }
    }

    // ── 面板装配投影 ──
    const team = { id: '_nat_team', name: nv.name ?? '', slots: teamSlots };
    const dbgConditions = {
      enemyStatusState: {
        toggles: {}, stacks: {}, hpThresholds: {},
        reactionDebuffs: { electrification: { active: false, level: 1, triggeringOperatorSlot: 0, corrosionTime: 0 },
          corrosion: { active: false, level: 1, triggeringOperatorSlot: 0, corrosionTime: 0 },
          breach: { active: false, level: 1, triggeringOperatorSlot: 0, corrosionTime: 0 } } },
      operatorStatusState: { stateToggles: {}, hpThresholds: {} } };
    if (process.env.DPS_DEBUG) {
      const dbg = getTeamStatus(team as AnyRec, opInsts, wpInsts, gearInsts, dbgConditions as AnyRec) as AnyRec;
      console.error('DBG panel attack =', dbg.operatorStatuses?.[0]?.attack,
                    '| base =', JSON.stringify(getBaseStatValues(opInsts[0], wpInsts[0])));
      console.error('DBG opInst =', JSON.stringify(opInsts[0]));
      console.error('DBG wpInst =', JSON.stringify(wpInsts[0]));
      console.error('DBG gears =', JSON.stringify(gearInsts.slice(0, 4)));
    }
    const conditions = {
      enemyStatusState: {
        toggles: {}, stacks: {}, hpThresholds: {},
        reactionDebuffs: {
          electrification: { active: false, level: 1, triggeringOperatorSlot: 0, corrosionTime: 0 },
          corrosion: { active: false, level: 1, triggeringOperatorSlot: 0, corrosionTime: 0 },
          breach: { active: false, level: 1, triggeringOperatorSlot: 0, corrosionTime: 0 },
        },
      },
      operatorStatusState: { stateToggles: {} as AnyRec },
    };
    const status = getTeamStatus(
      team as AnyRec, opInsts, wpInsts, gearInsts, conditions as AnyRec,
    ) as AnyRec;
    const os: AnyRec = status.operatorStatuses?.[index] ?? {};

    const stats = createDefaultStats() as AnyRec;
    stats.strength = os.attributes?.strength ?? 0;
    stats.agility = os.attributes?.agility ?? 0;
    stats.intellect = os.attributes?.intellect ?? 0;
    stats.will = os.attributes?.will ?? 0;
    stats.primary_ability = os.mainAttribute ?? 0;
    stats.secondary_ability = os.secondaryAttribute ?? 0;
    stats.attack = os.attack ?? 0;
    stats.hp = os.health ?? 0;
    stats.crit_rate = (os.critRate ?? 0) * 100;
    stats.crit_dmg = (os.critDmg ?? 0) * 100;
    stats.originium_arts_power = os.artsIntensity ?? 0;
    stats.ult_charge_eff = 100 + (os.ultimateGainEfficiency ?? 0);
    stats.link_cd_reduction = os.comboCdReductionPercent ?? 0;
    stats.combo_cd_reduction = os.comboCdReductionPercent ?? 0;
    stats.combo_cd_reduction_flat = os.comboCdReductionFlat ?? 0;
    stats.ult_cd_reduction = os.ultCdReductionPercent ?? 0;
    stats.ult_cd_reduction_flat = os.ultCdReductionFlat ?? 0;
    stats.combo_cd_external_mult = os.comboCdExternalMult ?? 1;
    stats.ult_cd_external_mult = os.ultCdExternalMult ?? 1;

    const baseStats = getBaseStatValues(opInst, wpInst);

    // 装备实例链接（主流程armory依赖这些字段收集装备增益）
    const equipRefs: AnyRec = {};
    const gearSlotConfigs = [
      { slotKey: 'armor', instKey: 'equipArmorInstanceId', idKey: 'equipArmorId', tierKey: 'equipArmorRefineTier' },
      { slotKey: 'gloves', instKey: 'equipGlovesInstanceId', idKey: 'equipGlovesId', tierKey: 'equipGlovesRefineTier' },
      { slotKey: 'kit1', instKey: 'equipAccessory1InstanceId', idKey: 'equipAccessory1Id', tierKey: 'equipAccessory1RefineTier' },
      { slotKey: 'kit2', instKey: 'equipAccessory2InstanceId', idKey: 'equipAccessory2Id', tierKey: 'equipAccessory2RefineTier' },
    ];
    gearSlotConfigs.forEach(({ slotKey, instKey, idKey, tierKey }, gi) => {
      const instId = gearMap[slotKey];
      const ginst = instId ? gearInsts.find(g => g.id === instId) : undefined;
      equipRefs[instKey] = instId;
      equipRefs[idKey] = ginst?.gearPieceId ?? null;
      equipRefs[tierKey] = ginst?.artificingLevels?.[gi] ?? 0;
    });

    if (process.env.DPS_DEBUG) {
      console.error(`DBG actions ${slug}:`);
      for (const a of actions.slice(0, 30)) {
        console.error(`  t=${(a.startTime / 60).toFixed(2)} ${a.name} seg=${a.attackSequenceIndex}/${a.attackSequenceTotal} hits=${a.hits.length} mult=${a.hits.map((x: any) => x.multiplier).join('/')}`);
      }
    }
    tracks.push({
      id: slug,
      operatorInstanceId: opInst.id,
      weaponInstanceId: wpInst?.id ?? null,
      weaponId: wpInst?.weaponSlug ?? null,
      weaponCommon1Tier: wpInst?.skill1Level ?? 0,
      weaponCommon2Tier: wpInst?.skill2Level ?? 0,
      weaponBuffTier: wpInst?.skill3Level ?? 0,
      ...equipRefs,
      actions,
      stats,
      baseStats,
      operatorStatus: os,
      gaugeEfficiency: Number(stats.ult_charge_eff) || 100,
      originiumArtsPower: Number(stats.originium_arts_power) || 0,
      linkCdReduction: Number(stats.link_cd_reduction) || 0,
      initialGauge: Number(cfg.initialGauge ?? 0),
      maxGaugeOverride: null,
      acceptTeamGauge: true,
      enemyStatus: {
        susceptibility: 0, resistanceShred: 0, defReduction: 0, increasedDmgTaken: 0,
        dmgReductionEffects: [], elementalSusceptibility: {}, elementalIncreasedDmgTaken: {},
        increasedDmgTakenExternalMult: 1, elementalIncreasedDmgTakenExternalMult: {},
      },
    });
  });

  // ── 增益与触发器 ──
  const team = { id: '_nat_team', name: nv.name ?? '', slots: teamSlots };
  const collected = collectEffectsNative(team, opInsts, wpInsts, gearInsts);
  const effectById = buildEffectById(collected as AnyRec[]);
  const collectedTriggers = collectTriggerEffectsNative(
    team, opInsts, wpInsts, gearInsts, effectById, collected);

  // ── 敌人 ──
  const enemy = nv.enemy ?? {};
  let activeEnemyId: string | null = 'custom';
  const systemConstants: AnyRec = {
    maxSp: Number(enemy.maxSp ?? 300),
    initialSp: Number(enemy.initialSp ?? 200),
    spRegenRate: Number(enemy.spRegen ?? 8),
    skillSpCostDefault: 100,
    linkCdReduction: 0,
  };
  let enemyName = enemy.name ?? '训练木桩（自定义）';
  if (enemy.id && enemy.id !== 'custom') {
    activeEnemyId = enemy.id;
    const sheet = getEnemy(enemy.id) as AnyRec;
    enemyName = enemy.name ?? sheet?.name ?? enemy.id;
    const level = Number(enemy.level ?? 90);
    const baseHp = levelHpAt(sheet?.levelHp, level);
    systemConstants.enemyHp = Number(enemy.hp ?? baseHp * Number(enemy.hpMultiplier ?? 1));
    systemConstants.defense = Number(enemy.defense ?? sheet?.def ?? 100);
    systemConstants.resistance = { ...((sheet?.resistance as AnyRec) ?? {}),
      ...(enemy.resistance ?? {}) };
    systemConstants.maxStagger = Number(enemy.maxStagger ?? sheet?.maxStagger ?? 320);
    systemConstants.staggerBreakDuration = Number(enemy.staggerBreakDuration ?? sheet?.staggerBreakDuration ?? 9);
    systemConstants.staggerNodeCount = Number(sheet?.staggerNodeCount ?? 0);
    systemConstants.staggerNodeDuration = Number(sheet?.staggerNodeDuration ?? 2);
    systemConstants.executionRecovery = Number(enemy.finisherRecovery ?? sheet?.finisherRecovery ?? 50);
    systemConstants.finisherMultiplier = Number(sheet?.finisherMultiplier ?? 1.5);
    systemConstants.superArmor = Number(sheet?.superArmor ?? 0);
    systemConstants.tier = sheet?.tier ?? 'normal';
  } else {
    systemConstants.enemyHp = Number(enemy.hp ?? 1e9);
    systemConstants.defense = Number(enemy.defense ?? 100);
    systemConstants.resistance = enemy.resistance ?? {
      physical: 0, heat: 0, cryo: 0, electric: 0, nature: 0 };
    systemConstants.maxStagger = Number(enemy.maxStagger ?? 1e9);
    systemConstants.staggerBreakDuration = Number(enemy.staggerBreakDuration ?? 9) * 60;
    systemConstants.executionRecovery = Number(enemy.finisherRecovery ?? 50);
    systemConstants.finisherMultiplier = Number(enemy.finisherMultiplier ?? 1.5);
    systemConstants.superArmor = 0;
    systemConstants.tier = 'normal';
  }

  return {
    data: {
      name: nv.name ?? '原生配置',
      tracks,
      connections: [],
      operators,
      weapons,
      gears,
      systemConstants,
      prepDuration: snapSec(prepSec),
      battleDuration: snapSec(durationSec),
      timeUnit: 'frame',
      timeUnitVersion: 2,
      fps: 60,
    },
    activeEnemyId,
    scenarioName: nv.name ?? '原生配置',
    enemyName,
  };

  // ── 内部辅助 ──
  function collectEffectsNative(team: AnyRec, opInsts: AnyRec[], wpInsts: AnyRec[],
                                 gearInsts: AnyRec[]) {
    // 复用 harness 主流程里的 collectEffects（已在作用域内导入）
    return (globalThis as AnyRec).__dpsendCollectEffects(
      team, opInsts, wpInsts, gearInsts);
  }
  function collectTriggerEffectsNative(team: AnyRec, opInsts: AnyRec[], wpInsts: AnyRec[],
                                       gearInsts: AnyRec[], effectById: AnyRec,
                                       collected: AnyRec[]) {
    return (globalThis as AnyRec).__dpsendCollectTriggers(
      team, opInsts, wpInsts, gearInsts, effectById);
  }
}

function levelHpAt(levelHp: AnyRec | undefined, level: number): number {
  if (!levelHp) return 1e9;
  if (levelHp[level] != null) return Number(levelHp[level]);
  const keys = Object.keys(levelHp).map(Number).sort((a, b) => a - b);
  let lower = keys[0];
  let upper = keys[keys.length - 1];
  for (const k of keys) {
    if (k <= level) lower = k;
    if (k >= level) { upper = k; break; }
  }
  if (lower === upper) return Number(levelHp[lower]);
  const a = Number(levelHp[lower]);
  const b = Number(levelHp[upper]);
  return a + (b - a) * (level - lower) / (upper - lower);
}

function getZhSkillNames(slug: string): AnyRec | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const zh = (globalThis as AnyRec).__dpsendZhOperators;
    return zh?.[slug] ?? null;
  } catch {
    return null;
  }
}
