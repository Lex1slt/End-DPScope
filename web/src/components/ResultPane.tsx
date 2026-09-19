import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FolderOpen,
  Loader2,
  ShieldCheck,
  SquareArrowOutUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/primitives";
import { cn, fmt } from "@/lib/utils";
import {
  hasDesktopSave,
  openReport,
  revealReport,
  saveReportAs,
  type CalcResult,
} from "@/lib/api";

const ELEMENTS: [string, string][] = [
  ["physical", "物理"],
  ["heat", "灼热"],
  ["cryo", "寒冷"],
  ["electric", "电磁"],
  ["nature", "自然"],
];

/** 结果数字滚动：计算完成这一刻的编排动效（尊重系统减弱动态效果）。 */
function useCountUp(target: number, token: string): number {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 850;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [token, target]);
  return v;
}

/** 桌面端空态：操作流程引导（也是右栏的「仪器面板」默认脸）。 */
function GuidePane() {
  const steps: [string, string, string][] = [
    ["1", "载入排轴", "Endaxis 导出的 JSON，点击或拖进来"],
    ["2", "校准敌人", "排轴内 / 训练木桩 / 敌人模板 / 自定义"],
    ["3", "队伍微调", "练度、武器、装备与精锻，只影响本次计算"],
    ["4", "开始计算", "输出 DPS 观测与 Excel 深度报告"],
  ];
  return (
    <Panel className="relative overflow-hidden px-5 py-5">
      <div
        aria-hidden
        className="num pointer-events-none absolute -right-3 -top-6 select-none text-[104px] font-bold leading-none text-[var(--text)] opacity-[0.04]"
      >
        DPS
      </div>
      <div className="text-[13px] font-semibold text-[var(--sub)]">观测台待命</div>
      <ol className="mt-3.5 space-y-3">
        {steps.map(([n, title, desc]) => (
          <li key={n} className="flex items-start gap-2.5">
            <span className="clip-corner-sm num mt-px grid h-[18px] w-[18px] shrink-0 place-items-center bg-[var(--accent)] text-[11px] font-bold text-[var(--on-accent)]">
              {n}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium">{title}</div>
              <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--faint)]">{desc}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-2 border-t border-[var(--border)] pt-3.5 text-[12px] text-[var(--sub)]">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--ok)]" />
        全程本地计算，排轴与报告都不出本机
      </div>
    </Panel>
  );
}

function RunningPane() {
  return (
    <Panel className="px-5 py-5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--sub)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
        正在逐击结算排轴…
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="h-9 w-3/5 animate-pulse rounded bg-[var(--surface2)]" />
        <div className="h-8 w-2/5 animate-pulse rounded bg-[var(--surface2)]" />
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="h-14 animate-pulse rounded bg-[var(--surface2)]" />
          <div className="h-14 animate-pulse rounded bg-[var(--surface2)]" />
          <div className="h-14 animate-pulse rounded bg-[var(--surface2)]" />
        </div>
      </div>
    </Panel>
  );
}

export function ResultPane({
  result,
  status,
}: {
  result: CalcResult | null;
  status: "idle" | "running" | "done" | "error";
}) {
  if (status === "running") return <RunningPane />;
  if (!result || status !== "done") return <GuidePane />;
  return <ReadoutPane result={result} />;
}

/** 计算完成的读数面板（独立组件：hook 不得在条件分支后调用）。 */
function ReadoutPane({ result }: { result: CalcResult }) {
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const s = result.summary;
  const total = s.totalDamage ?? 0;
  const left = s.enemyHpLeft;
  const dps = s.dps ?? 0;
  const animatedDps = useCountUp(dps, result.reportToken);
  const animatedTotal = useCountUp(total, result.reportToken);

  // 贡献率：每名干员（自身结算 + 拐力）占总伤害的比例——对主 C 与辅助同一把尺
  const bars = (result.lmdi ?? [])
    .map((r) => ({ ...r, contrib: r.dmg + r.buff }))
    .sort((a, b) => b.contrib - a.contrib)
    .slice(0, 5);
  const maxBar = Math.max(...bars.map((r) => r.contrib), 1);
  const ec = s.enemyConfig as Record<string, unknown> | undefined;
  const enemyCfgLine = ec
    ? `本次敌人配置：HP ${fmt(Number(ec.hp))} · 全抗 ${ELEMENTS.map(([k]) =>
        String((ec.resistance as Record<string, number>)?.[k] ?? 0),
      ).join("/")} · 防御 ${ec.defense ?? "—"} · 失衡上限 ${ec.maxStagger ?? "—"} · 失衡时长 ${ec.staggerBreakDuration ?? "—"}s`
    : "";
  const killed = left !== undefined && left <= 0;

  return (
    <Panel className="px-5 py-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--ok)]" />
        <h2 className="text-[13.5px] font-semibold">计算完成</h2>
        <span className="ml-auto truncate text-[11px] text-[var(--faint)]">
          {result.meta.scenario || "—"} · {result.meta.enemyName || "—"}
        </span>
      </div>
      <p className="num mt-1 text-[11.5px] text-[var(--sub)]">
        命中段数 {fmt(s.hitCount)} · 战斗时长 {(s.rotationTime ?? 0).toFixed(2)}s
      </p>

      {/* 主读数：DPS */}
      <div className="mt-4 border-t border-[var(--border)] pt-3.5">
        <div className="text-[11px] text-[var(--sub)]">DPS · 期望</div>
        <div className="num mt-1 text-[40px] font-bold leading-none tracking-tight text-[var(--accent)]">
          {animatedDps.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-[var(--surface2)] px-3 py-2.5">
            <div className="text-[11px] text-[var(--sub)]">总伤害（期望）</div>
            <div className="num mt-0.5 text-[17px] font-semibold">
              {fmt(Math.round(animatedTotal))}
            </div>
          </div>
          <div className="rounded-md bg-[var(--surface2)] px-3 py-2.5" title="总伤害 ÷ 轴消耗的技力总量">
            <div className="text-[11px] text-[var(--sub)]">DPSP</div>
            <div className="num mt-0.5 text-[17px] font-semibold">
              {(s.dpspHint ?? 0).toFixed(1)}
            </div>
          </div>
          <div className="rounded-md bg-[var(--surface2)] px-3 py-2.5">
            <div className="text-[11px] text-[var(--sub)]">敌人剩余血量</div>
            <div
              className={cn(
                "num mt-0.5 text-[17px] font-semibold",
                killed && "text-[var(--ok)]",
              )}
            >
              {left === undefined ? "—" : killed ? "已击杀" : fmt(left)}
            </div>
          </div>
          <div className="flex items-end justify-end pb-1 pr-1 text-right">
            {killed && (
              <span className="text-[12px] font-medium text-[var(--ok)]">轴内完成击杀 ✓</span>
            )}
          </div>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div
          className="mt-3.5 flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-[12.5px] leading-relaxed"
          style={{
            borderColor: "color-mix(in srgb, var(--warn) 35%, transparent)",
            background: "color-mix(in srgb, var(--warn) 7%, transparent)",
            color: "var(--warn)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{result.warnings.join("；")}</span>
        </div>
      )}

      {/* 贡献率：实心=自身伤害，斜纹=拐力 */}
      {bars.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[12px] font-medium text-[var(--sub)]">贡献率</div>
            <div className="flex items-center gap-3 text-[11px] text-[var(--faint)]">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm bg-[var(--accent)]" />
                自身伤害
              </span>
              <span className="flex items-center gap-1">
                <span className="stripe-buff inline-block h-2 w-3 rounded-sm" />
                拐力
              </span>
            </div>
          </div>
          <div className="mt-2.5 space-y-2">
            {bars.map((r) => (
              <div key={r.track} className="flex items-center gap-2.5">
                <span className="w-[76px] shrink-0 truncate text-right text-[12.5px]" title={r.name}>
                  {r.name}
                </span>
                <div
                  className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]"
                  title={`自身 ${fmt(r.dmg)} · 拐力 ${fmt(r.buff)}`}
                >
                  <div
                    className="h-full bg-[var(--accent)] transition-[width] duration-700 ease-out"
                    style={{ width: `${(r.dmg / maxBar) * 100}%` }}
                  />
                  <div
                    className="stripe-buff h-full transition-[width] duration-700 ease-out"
                    style={{ width: `${(r.buff / maxBar) * 100}%` }}
                  />
                </div>
                <span className="num w-[118px] shrink-0 text-right text-[11.5px] text-[var(--sub)]">
                  {fmt(r.contrib)}（{((r.contrib / total) * 100).toFixed(1)}%）
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--faint)]">
            干员实际伤害占总伤害的比例，详细归因见 Excel「拐力归因 / 贡献归因」表
          </p>
        </div>
      )}

      {/* 每秒输出 */}
      {result.stats && (
        <div className="mt-4 border-t border-[var(--border)] pt-3.5">
          <div className="flex items-baseline justify-between">
            <div className="text-[12px] font-medium text-[var(--sub)]">每秒输出</div>
            <div className="num text-[11px] text-[var(--faint)]">
              峰值 {result.stats.peakSec?.toFixed(0)}s · {fmt(result.stats.peakDmg)}
            </div>
          </div>
          <div className="chart-grid mt-2 flex h-[104px] items-end gap-[2px]">
            {(result.stats.perSec ?? []).map((p) => {
              const isPeak = p.dmg === result.stats!.peakDmg;
              const h = result.stats!.peakDmg ? Math.max(3, (p.dmg / result.stats!.peakDmg) * 100) : 3;
              return (
                <div
                  key={p.sec}
                  title={`${p.sec}s：${fmt(p.dmg)}`}
                  className={cn(
                    "min-w-[2px] flex-1 cursor-default rounded-t-[2px] transition-opacity",
                    isPeak ? "bg-[var(--accent)]" : "bg-[var(--accent)] opacity-65 hover:opacity-100",
                  )}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
          <div className="num mt-1 flex justify-between text-[10px] text-[var(--faint)]">
            <span>{result.stats.perSec?.[0]?.sec ?? 0}s</span>
            <span>{result.stats.perSec?.slice(-1)[0]?.sec ?? 0}s</span>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--sub)]">
            <span className="font-medium">深度体检：</span>
            失衡期伤害 {fmt(result.stats.staggerDmg)}
            （占 {(result.stats.staggerShare * 100).toFixed(1)}%，
            共 {result.stats.staggerWindows} 个窗口）
            　·　峰值秒 {result.stats.peakSec?.toFixed(0)}s 打出 {fmt(result.stats.peakDmg)}
            　·　失衡期是倍率最高的输出窗口，尽量让大招/处决落在窗口内
          </p>
        </div>
      )}

      {enemyCfgLine && (
        <p className="num mt-3 border-t border-[var(--border)] pt-2.5 text-[11px] leading-relaxed text-[var(--faint)]">
          {enemyCfgLine}
        </p>
      )}

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {hasDesktopSave() ? (
          <Button
            size="sm"
            onClick={async () => {
              try {
                const saved = await saveReportAs(result.reportToken);
                setActionMsg(saved ? `已保存到 ${saved}` : null);
              } catch (e) {
                setActionMsg(e instanceof Error ? e.message : "保存失败");
              }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            另存为…
          </Button>
        ) : (
          <a href={`/api/download?token=${result.reportToken}`} className="block">
            <Button size="sm" className="w-full">
              <Download className="h-3.5 w-3.5" />
              下载报告
            </Button>
          </a>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              const r = await openReport(result.reportToken);
              if (!r.ok) setActionMsg("打开失败：报告可能已过期，请重新计算");
              else setActionMsg(null);
            } catch {
              setActionMsg("打开失败：本地服务未响应");
            }
          }}
        >
          <SquareArrowOutUpRight className="h-3.5 w-3.5" />
          打开文件
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              const r = await revealReport(result.reportToken);
              if (!r.ok) setActionMsg("定位失败：报告可能已过期，请重新计算");
              else setActionMsg(null);
            } catch {
              setActionMsg("定位失败：本地服务未响应");
            }
          }}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          定位文件
        </Button>
      </div>
      {actionMsg && <p className="mt-2 break-all text-[11.5px] text-[var(--danger)]">{actionMsg}</p>}
    </Panel>
  );
}
