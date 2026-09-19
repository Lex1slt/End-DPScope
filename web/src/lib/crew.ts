// ── 目录（catalog.json）：武器/装备的名字与词条、精锻数值 ──

export interface CatalogAffix {
  name: string;
  value: number;
  levels: number[] | null;
  isPercent: boolean;
}
export interface CatalogGear {
  slug: string;
  slotType: string;
  name: string;
  set: string;
  setName: string;
  setEffect: string;
  defense: number | null;
  affixes: CatalogAffix[];
}
export interface CatalogSkill {
  key: "skill1" | "skill2" | "skill3";
  name: string;
  values: Array<number | number[]>;
  isPercent: boolean;
  desc: string;
}
export interface CatalogWeapon {
  slug: string;
  type: string;
  typeZh: string;
  rarity: number;
  name: string;
  skills: CatalogSkill[];
}
export interface Catalog {
  weapons: CatalogWeapon[];
  gearpieces: CatalogGear[];
}

/** 精锻等级 0~3 时词条的显示值（未分级词条是定值）。 */
export function affixValueText(a: CatalogAffix, level: number): string {
  const v =
    a.levels && a.levels.length > 0
      ? a.levels[Math.max(0, Math.min(a.levels.length - 1, level))]
      : a.value;
  if (v == null) return "";
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return a.isPercent ? `${text}%` : text;
}

/** 悬停提示：这条词条各级精锻分别是多少。 */
export function affixCurveText(a: CatalogAffix): string {
  if (!a.levels || a.levels.length === 0) return `${a.name}：${affixValueText(a, 0)}（不随精锻变化）`;
  return `${a.name}：精锻 0-3 → ${a.levels.map((v) => affixValueText({ ...a, levels: null, value: v }, 0)).join(" / ")}`;
}

/** 装备的悬停提示：防御 + 三条词条 + 套装效果。 */
export function gearTooltip(piece: CatalogGear | undefined): string {
  if (!piece) return "";
  const lines = [`${piece.name}（${piece.setName || "无套装"}）`];
  if (piece.defense != null) lines.push(`防御 ${piece.defense}`);
  for (const a of piece.affixes) lines.push(affixCurveText(a));
  if (piece.setEffect) lines.push(`〚${piece.setName}〛${piece.setEffect}`);
  return lines.join("\n");
}

/** 武器第 level 级（1 起）的技能数值文本，如「+156」「+39%」「32/16/32%」。 */
export function skillValueText(s: CatalogSkill, level: number): string {
  const raw = s.values[Math.max(0, Math.min(s.values.length - 1, level - 1))];
  if (raw == null) return "";
  const nums = Array.isArray(raw) ? raw : [raw];
  const text = nums
    .map((v) => (Number.isInteger(v) ? String(v) : (v as number).toFixed(1)))
    .join("/");
  return `+${text}${s.isPercent ? "%" : ""}`;
}

/** 悬停提示：技能描述模板代入当前等级的数值。 */
export function skillTooltip(s: CatalogSkill, level: number): string {
  if (!s.desc) return "";
  const raw = s.values[Math.max(0, Math.min(s.values.length - 1, level - 1))];
  return s.desc.replace(/\{(\d+)\}/g, (_, i) => {
    const v = Array.isArray(raw) ? raw[Number(i)] : raw;
    if (v == null) return "?";
    const text = Number.isInteger(v) ? String(v) : (v as number).toFixed(1);
    return s.isPercent || Array.isArray(raw) ? `${text}${s.isPercent ? "%" : ""}` : text;
  });
}

/**
 * 武器三条技能的合法等级范围（与 Endaxis weaponBounds.ts 同口径）：
 * 等级 1/20/40/60/80/90 决定突破档位，skill1/2 上限随档位涨，skill3 上限随潜能涨。
 */
export function weaponSkillBounds(level: number, tuned: boolean, potential: number) {
  let t = 0;
  if (level >= 90) t = 4;
  else if (level >= 80) t = tuned ? 4 : 3;
  else if (level >= 60) t = tuned ? 3 : 2;
  else if (level >= 40) t = tuned ? 2 : 1;
  else if (level >= 20) t = tuned ? 1 : 0;
  return {
    skill1: { min: 1 + Math.ceil(t / 2), max: 3 + Math.ceil(t * 1.5) },
    skill2: { min: 1 + Math.floor(t / 2), max: 3 + Math.floor(t * 1.5) },
    skill3: { min: 1 + potential, max: 4 + potential },
  } as Record<string, { min: number; max: number }>;
}

/** 武器下拉项的悬停提示：类型/星级 + 三条技能名称。 */
export function weaponOptionTitle(w: CatalogWeapon): string {
  const lines = [`${w.name}　${w.typeZh || w.type}　${"★".repeat(w.rarity)}`];
  for (const s of w.skills) lines.push(`· ${s.name}`);
  return lines.join("\n");
}

/** 武器突破档位：由武器等级与是否突破推算（影响前两条技能的等级上限）。 */
export function weaponTier(level: number, tuned: boolean): number {
  if (level >= 90) return 4;
  if (level >= 80) return tuned ? 4 : 3;
  if (level >= 60) return tuned ? 3 : 2;
  if (level >= 40) return tuned ? 2 : 1;
  if (level >= 20) return tuned ? 1 : 0;
  return 0;
}

// ── 队伍配置（从排轴解析出的练度实例） ──

export interface CrewGear {
  slot: string;
  slotType: string;
  label: string;
  pieceId: string;
  levels: number[];
}
export interface CrewMember {
  track: string;
  operatorSlug: string;
  level: number;
  promoted: boolean;
  potential: number;
  trustLevel: number;
  talents: { "0": number; "1": number };
  skillLevels: {
    basicAttack: number;
    battleSkill: number;
    comboSkill: number;
    ultimate: number;
  };
  weaponSlug: string | null;
  weapon: {
    level: number;
    tuned: boolean;
    potential: number;
    skill1Level: number;
    skill2Level: number;
    skill3Level: number;
  };
  gears: CrewGear[];
}

export const GEAR_SLOT_DEFS: [string, string, string, string][] = [
  ["armor", "护甲", "armor", "equipArmorInstanceId"],
  ["gloves", "护手", "gloves", "equipGlovesInstanceId"],
  ["kit1", "配件Ⅰ", "kit", "equipAccessory1InstanceId"],
  ["kit2", "配件Ⅱ", "kit", "equipAccessory2InstanceId"],
];

/** 干员精英化阶段（与引擎 getPromotionCount 同口径）：等级过门槛后需完成精英化才升阶段 */
export function promoCount(level: number, promoted: boolean): number {
  if (level >= 90) return 4;
  if (level >= 80) return promoted ? 4 : 3;
  if (level >= 60) return promoted ? 3 : 2;
  if (level >= 40) return promoted ? 2 : 1;
  if (level >= 20) return promoted ? 1 : 0;
  return 0;
}

/** 目录里的名字正常是字符串；万一拿到 i18n 对象也不能把整页渲染炸掉。 */
export function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const rec = v as Record<string, unknown>;
    for (const k of ["name", "setName"]) {
      if (typeof rec[k] === "string") return rec[k] as string;
    }
  }
  return "";
}

export const SKILL_FIELDS: [keyof CrewMember["skillLevels"], string][] = [
  ["basicAttack", "普攻"],
  ["battleSkill", "战技"],
  ["comboSkill", "连携"],
  ["ultimate", "终结技"],
];

export function parseCrew(project: any): CrewMember[] {
  const data = project?.scenarioList?.[0]?.data ?? {};
  const ops = new Map<string, any>(
    (data.operators ?? []).map((o: any) => [o.id, o] as [string, any]),
  );
  const wps = new Map<string, any>(
    (data.weapons ?? []).map((w: any) => [w.id, w] as [string, any]),
  );
  const ges = new Map<string, any>(
    (data.gears ?? []).map((g: any) => [g.id, g] as [string, any]),
  );
  const crew: CrewMember[] = [];
  for (const tr of data.tracks ?? []) {
    const op = ops.get(tr.operatorInstanceId);
    if (!op) continue;
    const wp = wps.get(tr.weaponInstanceId);
    const gears: CrewGear[] = GEAR_SLOT_DEFS.map(([slot, label, slotType, key]) => {
      const g = ges.get(tr[key]);
      // 词条最多三条；导出轴里可能出现第 4 个条目，引擎（collect.ts:483）只读前三条
      const levels = (g?.artificingLevels ?? []).slice(0, 3);
      while (levels.length < 3) levels.push(0);
      return {
        slot,
        slotType,
        label,
        pieceId: g?.gearPieceId ?? "—",
        levels,
      };
    });
    crew.push({
      track: tr.id,
      operatorSlug: op.operatorSlug ?? "",
      level: op.level ?? 90,
      promoted: !!op.promoted,
      potential: op.potential ?? 0,
      trustLevel: op.trustLevel ?? 0,
      talents: {
        "0": op.talentStates?.["0"] ?? 0,
        "1": op.talentStates?.["1"] ?? 0,
      },
      skillLevels: {
        basicAttack: op.skillLevels?.basicAttack ?? 1,
        battleSkill: op.skillLevels?.battleSkill ?? 1,
        comboSkill: op.skillLevels?.comboSkill ?? 1,
        ultimate: op.skillLevels?.ultimate ?? 1,
      },
      weaponSlug: wp?.weaponSlug ?? null,
      weapon: {
        level: wp?.level ?? 1,
        tuned: !!wp?.tuned,
        potential: wp?.potential ?? 0,
        skill1Level: wp?.skill1Level ?? 0,
        skill2Level: wp?.skill2Level ?? 0,
        skill3Level: wp?.skill3Level ?? 0,
      },
      gears,
    });
  }
  return crew;
}
