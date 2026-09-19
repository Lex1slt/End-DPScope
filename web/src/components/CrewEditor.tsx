import { Input, Select, ToggleChip } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/utils";
import {
  affixCurveText,
  affixValueText,
  gearTooltip,
  promoCount,
  skillTooltip,
  skillValueText,
  SKILL_FIELDS,
  text,
  weaponOptionTitle,
  weaponSkillBounds,
  weaponTier,
  type Catalog,
  type CatalogSkill,
  type CrewMember,
} from "@/lib/crew";

/** 一组字段的行头：左侧组名，右侧字段格横向流式排布。 */
function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 border-t border-[var(--border)] py-2.5 first:border-t-0 sm:gap-4">
      <span className="w-[64px] shrink-0 pt-[3px] text-[12px] leading-[14px] text-[var(--sub)]">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-2">
        {children}
      </div>
    </div>
  );
}

/** 字段格：小标签在上，控件在下。 */
function Cell({
  label,
  hint,
  w,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  w?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", w)} title={hint}>
      <span className="truncate text-[11px] leading-none text-[var(--sub)]">{label}</span>
      {children}
    </label>
  );
}

export function CrewEditor({
  crew,
  updateCrew,
  catalog,
  names,
}: {
  crew: CrewMember[];
  updateCrew: (idx: number, patch: (m: CrewMember) => void) => void;
  catalog: Catalog;
  names: { operators: Record<string, string>; weapons: Record<string, string> };
}) {
  return (
    <div className="space-y-3">
      {crew.map((m, i) => {
        const opName = names.operators[m.operatorSlug] || m.operatorSlug;

        // 套装按「三件生效」判定，换装备时直接能看到有没有掉套装
        const setCounts = new Map<string, { name: string; effect: string; count: number }>();
        for (const g of m.gears) {
          const gp = catalog.gearpieces.find((x) => x.slug === g.pieceId);
          if (!gp?.set) continue;
          const cur = setCounts.get(gp.set) ?? {
            name: text(gp.setName) || gp.set,
            effect: text(gp.setEffect),
            count: 0,
          };
          cur.count += 1;
          setCounts.set(gp.set, cur);
        }
        const setBadges = [...setCounts.entries()].map(([slug, v]) => ({ slug, ...v }));

        const weapon = m.weaponSlug
          ? catalog.weapons.find((w) => w.slug === m.weaponSlug)
          : undefined;
        const wType = weapon?.type ?? "";
        const weaponOptions = catalog.weapons.filter((w) => !wType || w.type === wType);
        const bounds = weaponSkillBounds(m.weapon.level, m.weapon.tuned, m.weapon.potential);

        return (
          <div key={m.track} className="rounded-lg border border-[var(--border)] px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] font-semibold">{opName}</span>
              <span className="num truncate text-[11px] text-[var(--faint)]">
                {m.operatorSlug}
              </span>
            </div>

            <div className="mt-1.5">
              <FieldGroup label="干员练度">
                <Cell label="等级" w="w-16">
                  <Input
                    className="text-center"
                    value={m.level}
                    onChange={(e) =>
                      updateCrew(i, (m2) => {
                        m2.level = Number(e.target.value) || 0;
                      })
                    }
                  />
                </Cell>
                <Cell label="精英化">
                  <ToggleChip
                    on={m.promoted}
                    onText="已精英化"
                    offText="未精英化"
                    title="是否完成精英化"
                    onClick={() => updateCrew(i, (m2) => (m2.promoted = !m2.promoted))}
                  />
                </Cell>
                <span
                  className="num self-end pb-1.5 text-[11px] text-[var(--faint)]"
                  title="按当前等级 90/80/60/40/20 门槛与精英化标记推算（与引擎同口径）"
                >
                  阶段 {promoCount(m.level, m.promoted)}/4
                </span>
                <Cell label="潜能" w="w-14">
                  <Input
                    className="text-center"
                    value={m.potential}
                    onChange={(e) =>
                      updateCrew(i, (m2) => {
                        m2.potential = Number(e.target.value) || 0;
                      })
                    }
                  />
                </Cell>
                <Cell label="信赖" w="w-14">
                  <Input
                    className="text-center"
                    value={m.trustLevel}
                    onChange={(e) =>
                      updateCrew(i, (m2) => {
                        m2.trustLevel = Number(e.target.value) || 0;
                      })
                    }
                  />
                </Cell>
              </FieldGroup>

              <FieldGroup label="技能等级">
                {SKILL_FIELDS.map(([k, label]) => (
                  <Cell key={k} label={label} w="w-14">
                    <Input
                      className="text-center"
                      value={m.skillLevels[k]}
                      onChange={(e) =>
                        updateCrew(i, (m2) => {
                          m2.skillLevels[k] = Number(e.target.value) || 0;
                        })
                      }
                    />
                  </Cell>
                ))}
                <span className="self-end pb-1.5 text-[11px] text-[var(--faint)]">
                  含专精
                </span>
              </FieldGroup>

              <FieldGroup label="天赋">
                <Cell label="天赋Ⅰ" w="w-14">
                  <Input
                    className="text-center"
                    value={m.talents["0"]}
                    onChange={(e) =>
                      updateCrew(i, (m2) => {
                        m2.talents["0"] = Number(e.target.value) || 0;
                      })
                    }
                  />
                </Cell>
                <Cell label="天赋Ⅱ" w="w-14">
                  <Input
                    className="text-center"
                    value={m.talents["1"]}
                    onChange={(e) =>
                      updateCrew(i, (m2) => {
                        m2.talents["1"] = Number(e.target.value) || 0;
                      })
                    }
                  />
                </Cell>
              </FieldGroup>

              {m.weaponSlug && weapon && (
                <>
                  <FieldGroup label="武器">
                    <Cell
                      label={names.weapons[m.weaponSlug] || text(weapon.name) || "武器"}
                      w="w-40"
                      hint={weaponOptionTitle(weapon)}
                    >
                      <Select
                        value={m.weaponSlug}
                        onChange={(e) =>
                          updateCrew(i, (m2) => {
                            m2.weaponSlug = e.target.value;
                          })
                        }
                      >
                        {weaponOptions.map((w) => (
                          <option key={w.slug} value={w.slug} title={weaponOptionTitle(w)}>
                            {text(w.name)}
                          </option>
                        ))}
                      </Select>
                    </Cell>
                    <Cell label="等级" w="w-16">
                      <Input
                        className="text-center"
                        value={m.weapon.level}
                        onChange={(e) =>
                          updateCrew(i, (m2) => {
                            m2.weapon.level = Number(e.target.value) || 0;
                          })
                        }
                      />
                    </Cell>
                    <Cell label="突破">
                      <ToggleChip
                        on={m.weapon.tuned}
                        onText="已突破"
                        offText="未突破"
                        title="武器突破：90 级即满突破；突破档位影响前两条技能的等级上限"
                        onClick={() =>
                          updateCrew(i, (m2) => (m2.weapon.tuned = !m2.weapon.tuned))
                        }
                      />
                    </Cell>
                    <span
                      className="num self-end pb-1.5 text-[11px] text-[var(--faint)]"
                      title="武器突破档位：由武器等级与是否突破推算（影响前两条技能的等级上限）"
                    >
                      档位 {weaponTier(m.weapon.level, m.weapon.tuned)}/4
                    </span>
                    <Cell label="潜能" w="w-14" hint="武器潜能（0-5），决定第三条技能的等级范围">
                      <Input
                        className="text-center"
                        value={m.weapon.potential}
                        onChange={(e) =>
                          updateCrew(i, (m2) => {
                            m2.weapon.potential = Number(e.target.value) || 0;
                          })
                        }
                      />
                    </Cell>
                  </FieldGroup>

                  {/* 三条技能用武器自己的名字（如 力量 / 攻击力 / 迸发·切骨之寒） */}
                  {weapon.skills.length > 0 && (
                    <FieldGroup label="武器技能">
                      {weapon.skills.map((s: CatalogSkill) => {
                        const lv = m.weapon[`${s.key}Level` as "skill1Level"];
                        const b = bounds[s.key];
                        return (
                          <Cell
                            key={s.key}
                            label={text(s.name)}
                            w="w-[88px]"
                            hint={`${skillTooltip(s, lv)}\n合法等级 ${b.min}-${b.max}（当前武器等级/突破/潜能下）`}
                          >
                            <span className="flex items-center gap-1">
                              <Input
                                className="w-11 text-center"
                                value={lv}
                                onChange={(e) =>
                                  updateCrew(i, (m2) => {
                                    m2.weapon[`${s.key}Level`] = Number(e.target.value) || 0;
                                  })
                                }
                              />
                              <span className="num min-w-9 text-[11px] text-[var(--faint)]">
                                {skillValueText(s, lv)}
                              </span>
                            </span>
                          </Cell>
                        );
                      })}
                    </FieldGroup>
                  )}
                </>
              )}

              {m.gears.map((g, gi) => {
                const piece = catalog.gearpieces.find((x) => x.slug === g.pieceId);
                return (
                  <FieldGroup key={g.slot} label={`装备 · ${g.label}`}>
                    <Cell
                      label={text(piece?.name) || "部件"}
                      w="w-40"
                      hint={gearTooltip(piece)}
                    >
                      <Select
                        title={gearTooltip(piece)}
                        value={g.pieceId}
                        onChange={(e) =>
                          updateCrew(i, (m2) => {
                            m2.gears[gi].pieceId = e.target.value;
                          })
                        }
                      >
                        {catalog.gearpieces
                          .filter((gp) => gp.slotType === g.slotType)
                          .map((gp) => (
                            <option key={gp.slug} value={gp.slug} title={gearTooltip(gp)}>
                              {text(gp.name)}
                              {gp.setName ? `（${text(gp.setName)}）` : ""}
                            </option>
                          ))}
                      </Select>
                    </Cell>
                    {/* 每条词条一个精锻等级（0-3），旁边直接显示当前数值 */}
                    {(piece?.affixes ?? []).map((a, ai) => {
                      const lv = g.levels[ai] ?? 0;
                      return (
                        <Cell
                          key={`${g.slot}-${ai}`}
                          label={text(a.name)}
                          w="w-[86px]"
                          hint={affixCurveText(a)}
                        >
                          <span className="flex items-center gap-1">
                            <Input
                              className="w-10 text-center"
                              value={lv}
                              onChange={(e) =>
                                updateCrew(i, (m2) => {
                                  m2.gears[gi].levels[ai] = Number(e.target.value) || 0;
                                })
                              }
                            />
                            <span className="num min-w-9 text-[11px] text-[var(--faint)]">
                              {affixValueText(a, lv)}
                            </span>
                          </span>
                        </Cell>
                      );
                    })}
                    {piece?.defense != null && (
                      <span
                        className="num self-end pb-1.5 text-[11px] text-[var(--faint)]"
                        title="装备自带防御"
                      >
                        防 {fmt(piece.defense)}
                      </span>
                    )}
                  </FieldGroup>
                );
              })}
            </div>

            {setBadges.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[var(--faint)]">已穿套装</span>
                {setBadges.map((b) => (
                  <span
                    key={b.slug}
                    title={b.effect || undefined}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px]",
                      b.count >= 3
                        ? "border-[var(--accent)]/60 bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--faint)]",
                    )}
                  >
                    {b.name} {b.count}/3{b.count >= 3 ? " ✓" : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs leading-relaxed text-[var(--faint)]">
        词条与技能名称、精锻数值均取自游戏数据；鼠标停在装备/词条/技能上可看各级数值。
        仅修改数值与效果（含套装效果，三件生效）；不校验轴的技力/充能/CD 可行性——
        轴上动作按时刻表强制结算（非法轴口径）。改动仅对本次计算生效，不写回排轴文件。
      </p>
    </div>
  );
}
