import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpCircle,
  FileJson2,
  HelpCircle,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
} from "lucide-react";
import { Badge, Card, Input, Notice, Segmented, Select } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { CrewEditor } from "@/components/CrewEditor";
import { ResultPane } from "@/components/ResultPane";
import { cn, fmt } from "@/lib/utils";
import { parseCrew, type Catalog, type CrewMember } from "@/lib/crew";
import {
  engineStatus,
  engineUpdate,
  fetchNames,
  openHelp,
  runCalculate,
  syncNow,
  type CalcResult,
  type CrewOverride,
  type NameMaps,
  type Settings,
} from "@/lib/api";

const ELEMENTS: [string, string][] = [
  ["physical", "物理"],
  ["heat", "灼热"],
  ["cryo", "寒冷"],
  ["electric", "电磁"],
  ["nature", "自然"],
];

const ENEMY_MODES = [
  { value: "timeline", label: "排轴内敌人" },
  { value: "dummy", label: "训练木桩" },
  { value: "template", label: "敌人模板" },
  { value: "custom", label: "自定义" },
] as const;

type Skin = "endfield" | "rhodes" | "pioneer";
const SKINS: { value: Skin; label: string; dot: string }[] = [
  { value: "endfield", label: "结束剂 · 工业黑黄", dot: "#ffd100" },
  { value: "rhodes", label: "罗德岛 · 冰蓝科技", dot: "#38bdf8" },
  { value: "pioneer", label: "拓荒者 · 荒原琥珀", dot: "#f59e0b" },
];

const DEFAULT_SETTINGS: Settings = {
  enemyMode: "timeline",
  custom: {
    // 默认靶子：1 亿血、全抗 20，失衡参数同天鼓（320 / 9s）
    hp: "100000000",
    def: "100",
    res: { physical: "20", heat: "20", cryo: "20", electric: "20", nature: "20" },
    stagger: "320",
    breakDur: "9",
    execSp: "50",
  },
  template: { id: "", level: "90", hpmult: "1.0" },
  crit: "",
  cdmg: "",
  operators: [],
};

function useAppearance() {
  // 首次使用默认暗色（工业观测台主场景）；已存偏好则尊重
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("dpsend-theme");
    return stored ? stored === "dark" : true;
  });
  const [skin, setSkin] = useState<Skin>(
    () => (localStorage.getItem("dpsend-skin") as Skin) || "endfield",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dpsend-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    document.documentElement.dataset.skin = skin;
    localStorage.setItem("dpsend-skin", skin);
  }, [skin]);
  return { dark, setDark, skin, setSkin };
}

function useSyncStatus() {
  const [status, setStatus] = useState<{ lastSync: number | null; syncing: boolean } | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      /* 服务未启动时静默 */
    }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);
  return { status, refresh };
}

function useUpdateInfo() {
  const [info, setInfo] = useState<{
    engineUpdateAvailable: boolean;
    engineRemote?: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/update");
        if (alive && res.ok) {
          const data = await res.json();
          setInfo({
            engineUpdateAvailable: !!data?.engine?.updateAvailable,
            engineRemote: data?.engine?.remote,
          });
        }
      } catch {
        /* 静默 */
      }
    };
    tick();
    const t = setInterval(tick, 600000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return info;
}

function relTime(ts: number | null): string {
  if (!ts) return "未同步";
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 90) return "刚刚";
  if (diff < 3600) return `${Math.round(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.round(diff / 3600)} 小时前`;
  return `${Math.round(diff / 86400)} 天前`;
}

function Section({
  step,
  title,
  desc,
  children,
}: {
  step: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="px-4 py-4 sm:px-5">
      <div className="flex items-center gap-2.5">
        <span className="clip-corner-sm num grid h-[22px] w-[22px] shrink-0 place-items-center bg-[var(--accent)] text-[12px] font-bold text-[var(--on-accent)]">
          {step}
        </span>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {desc && <span className="min-w-0 truncate text-[12px] text-[var(--faint)]">{desc}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** 表单行：左侧标签，右侧字段格。 */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-[var(--border)] py-2.5 first:border-t-0 sm:gap-4">
      <span className="w-[64px] shrink-0 pt-[3px] text-[12px] leading-[14px] text-[var(--sub)]">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-2">{children}</div>
    </div>
  );
}

/** 计算核心一键更新条：下载上游 → 打补丁 → 冒烟 → 切版本，全程后台。 */
function UpdateStrip({ remote }: { remote?: string }) {
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  const start = async () => {
    try {
      const r = await engineUpdate();
      if (!r.started) return;
      setRunning(true);
      poll.current = setInterval(async () => {
        const st = await engineStatus();
        if (!st.running && poll.current) {
          clearInterval(poll.current);
          poll.current = null;
          setRunning(false);
          setMsg(st.lastResult?.ok ? `更新完成（${st.lastResult.message}）` : st.lastResult?.message ?? "更新失败");
        }
      }, 2000);
    } catch {
      setRunning(false);
      setMsg("更新请求失败");
    }
  };

  return (
    <div className="border-b border-[var(--border)] bg-[var(--accent-soft)]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[12.5px] sm:px-6">
        <ArrowUpCircle className="h-4 w-4 shrink-0 text-[var(--accent)]" />
        <span>
          计算核心有新版本<span className="num text-[var(--sub)]">（{remote ?? ""}）</span>
        </span>
        <Button size="sm" onClick={start} disabled={running}>
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              更新中…
            </>
          ) : (
            "一键更新"
          )}
        </Button>
        {msg && <span className="text-[var(--sub)]">{msg}</span>}
        <span className="ml-auto hidden text-[11px] text-[var(--faint)] sm:block">
          下载上游 → 打补丁 → 冒烟 → 切版本
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const { dark, setDark, skin, setSkin } = useAppearance();
  const sync = useSyncStatus();
  const updateInfo = useUpdateInfo();
  const [names, setNames] = useState<NameMaps>({ operators: {}, weapons: {}, enemies: {} });
  const [catalog, setCatalog] = useState<Catalog>({ weapons: [], gearpieces: [] });
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [timelineSummary, setTimelineSummary] = useState("");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNames().then(setNames);
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCatalog(d))
      .catch(() => {});
  }, []);

  const readFile = useCallback((file: File) => {
    setFileName(file.name);
    file.text().then((text) => {
      setFileText(text);
      setResult(null);
      setStatus("idle");
      setSettings((s) => ({ ...s, operators: [] }));
      try {
        const p = JSON.parse(text);
        const sc =
          (p?.scenarioList ?? []).find((s: { id?: string }) => s.id === p?.activeScenarioId) ??
          p?.scenarioList?.[0];
        const sysc = sc?.data?.systemConstants;
        if (sysc?.enemyHp) {
          const resMap = sysc.resistance ?? {};
          setTimelineSummary(
            `排轴内实际值：HP ${fmt(sysc.enemyHp)} · 全抗 ${ELEMENTS.map(([k]) => resMap[k] ?? 0).join("/")} · ` +
              `防御 ${sysc.defense ?? 100} · 失衡上限 ${sysc.maxStagger ?? "—"}`,
          );
        } else {
          setTimelineSummary("排轴内未携带敌人配置（将按模拟器默认：防御 100）");
        }
        const eid: string | undefined = p?.activeEnemyId;
        if (eid) {
          setSettings((s) => ({ ...s, template: { ...s.template, id: eid } }));
        }
        setCrew(p.__native ? [] : parseCrew(p));
      } catch {
        setTimelineSummary("⚠ 文件不是有效的 JSON，计算时会报错");
        setCrew([]);
      }
    });
  }, []);

  function updateCrew(idx: number, patch: (m: CrewMember) => void) {
    setCrew((list) => {
      const next = [...list];
      const m = { ...next[idx] };
      patch(m);
      next[idx] = m;
      return next;
    });
  }

  function crewOverrides(): CrewOverride[] {
    return crew.map((m) => ({
      track: m.track,
      level: m.level,
      promoted: m.promoted,
      potential: m.potential,
      trustLevel: m.trustLevel,
      talents: { ...m.talents },
      skillLevels: { ...m.skillLevels },
      weapon: { slug: m.weaponSlug ?? undefined, ...m.weapon },
      gears: Object.fromEntries(
        m.gears.map((g) => [
          g.slot,
          // "—" 是解析不到部件时的占位符，不能当成 slug 传给计算核心
          { pieceId: g.pieceId && g.pieceId !== "—" ? g.pieceId : undefined, levels: g.levels },
        ]),
      ),
    }));
  }

  async function run() {
    if (!fileText || status === "running") return;
    setStatus("running");
    setErrorMsg(null);
    try {
      const project = JSON.parse(fileText);
      const data = await runCalculate(fileName, project, {
        ...settings,
        operators: crewOverrides(),
      });
      setResult(data);
      setStatus("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg === "Failed to fetch" ? "无法连接本地计算服务，请重新启动 DPS-END" : msg);
      setStatus("error");
    }
  }

  // 右栏在窄屏上的显隐：只有出了结果/正在计算才占位（引导面板仅桌面展示）
  const asideVisible = status === "running" || status === "done";

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* ── 顶栏 ── */}
      <header className="sticky top-0 z-20 bg-[var(--surface)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-[56px] max-w-[1200px] items-center gap-2.5 px-4 sm:px-6">
          <div className="clip-corner grid h-[30px] w-[30px] place-items-center bg-[var(--accent)]">
            <span className="num text-[15px] font-bold text-[var(--on-accent)]">D</span>
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight">End-DPScope</span>
            <span className="text-[10.5px] text-[var(--faint)]">终末地 · 伤害观测台</span>
          </div>
          <Badge className="num hidden sm:inline-flex">v1.0</Badge>

          <div className="ml-auto flex items-center gap-1.5">
            {/* 游戏数据同步状态：点击立即同步 */}
            <button
              onClick={async () => {
                try {
                  await syncNow();
                  const deadline = Date.now() + 120_000;
                  while (Date.now() < deadline) {
                    await new Promise((r) => setTimeout(r, 1500));
                    const st = await fetch("/api/sync/status").then((r) => r.json());
                    if (!st.syncing) {
                      sync.refresh();
                      if (st.lastError) setSyncMsg(`同步失败：${st.lastError}`);
                      else if (st.lastSync) setSyncMsg("已同步");
                      break;
                    }
                  }
                } catch {
                  setSyncMsg("同步失败：本地服务未响应");
                }
              }}
              title={
                syncMsg
                  ? `${syncMsg}（点击立即同步游戏数据）`
                  : "点击立即同步游戏数据（AKEData）"
              }
              className="hidden h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface2)] px-2.5 text-[12px] text-[var(--sub)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)] md:flex"
            >
              <RefreshCw
                className={cn(
                  "h-3 w-3",
                  sync.status?.syncing && "animate-spin text-[var(--accent)]",
                )}
              />
              <span className="num">
                数据 · {sync.status?.syncing ? "同步中…" : relTime(sync.status?.lastSync ?? null)}
              </span>
            </button>
            {syncMsg && (
              <span
                className={cn(
                  "num hidden max-w-[130px] truncate text-[11px] lg:block",
                  syncMsg.startsWith("同步失败") ? "text-[var(--danger)]" : "text-[var(--ok)]",
                )}
                title={syncMsg}
              >
                {syncMsg}
              </span>
            )}

            <div className="mx-1 hidden h-5 w-px bg-[var(--border)] sm:block" />

            {/* 皮肤切换 */}
            <div className="flex items-center gap-1.5" role="group" aria-label="皮肤">
              {SKINS.map((sk) => (
                <button
                  key={sk.value}
                  title={sk.label}
                  aria-label={`皮肤：${sk.label}`}
                  aria-pressed={skin === sk.value}
                  onClick={() => setSkin(sk.value)}
                  className={cn(
                    "h-4 w-4 cursor-pointer rounded-full transition-transform hover:scale-110",
                    skin === sk.value &&
                      "scale-110 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]",
                    skin !== sk.value && "opacity-45",
                  )}
                  style={{ background: sk.dot }}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark(!dark)}
              aria-label="切换主题"
              title="切换明暗主题"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="功能说明"
              title="打开功能说明（程序目录下的 功能说明.md）"
              onClick={async () => {
                try {
                  await openHelp();
                } catch (e) {
                  // 结果卡片还没出现时页面上没有提示位，这里直接用系统弹窗保证可见
                  window.alert(e instanceof Error ? e.message : "打开说明失败");
                }
              }}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="hazard h-[3px] w-full opacity-90" />
      </header>

      {updateInfo?.engineUpdateAvailable && <UpdateStrip remote={updateInfo.engineRemote} />}

      {/* ── 双栏工作台：左配置流 / 右观测读数 ── */}
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_396px] lg:items-start lg:gap-5">
          <div className="min-w-0 space-y-4">
            {/* ── ① 排轴文件 ── */}
            <Section step="1" title="排轴文件" desc="Endaxis 导出 JSON，或本项目原生配置">
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f);
                }}
              />
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) readFile(f);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-7 text-center transition-colors",
                  drag
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border-strong)] hover:border-[var(--accent)]/60 hover:bg-[var(--accent-soft)]",
                )}
              >
                <FileJson2 className="h-5 w-5 text-[var(--faint)]" />
                {fileName ? (
                  <>
                    <div className="text-[13px] font-medium">{fileName}</div>
                    <div className="text-[11px] text-[var(--faint)]">点击更换文件</div>
                  </>
                ) : (
                  <>
                    <div className="text-[13px] text-[var(--sub)]">
                      点击选择，或把排轴 JSON 拖进来
                    </div>
                    <div className="text-[11px] text-[var(--faint)]">全程本地计算，文件不会被上传</div>
                  </>
                )}
              </div>
            </Section>

            {/* ── ② 敌人配置 ── */}
            <Section step="2" title="敌人配置">
              <Segmented
                options={[...ENEMY_MODES]}
                value={settings.enemyMode}
                onChange={(v) => setSettings((s) => ({ ...s, enemyMode: v }))}
              />
              {settings.enemyMode === "timeline" && timelineSummary && (
                <p className="num mt-3 text-xs leading-relaxed text-[var(--sub)]">
                  {timelineSummary}
                </p>
              )}
              {settings.enemyMode === "template" && (
                <div className="mt-2.5">
                  <FieldRow label="模板 ID">
                    <Input
                      className="w-full max-w-56"
                      placeholder="如 eny_0082_hsbear"
                      value={settings.template.id}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, template: { ...s.template, id: e.target.value } }))
                      }
                    />
                  </FieldRow>
                  <FieldRow label="等级 / 倍率">
                    <Input
                      className="w-20 text-center"
                      title="敌人等级"
                      value={settings.template.level}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          template: { ...s.template, level: e.target.value },
                        }))
                      }
                    />
                    <Input
                      className="w-20 text-center"
                      title="血量倍率"
                      value={settings.template.hpmult}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          template: { ...s.template, hpmult: e.target.value },
                        }))
                      }
                    />
                  </FieldRow>
                  <p className="border-t border-[var(--border)] pt-2.5 text-xs leading-relaxed text-[var(--faint)]">
                    直接读取 AKEData 解包的真实数值（全抗 0、基础 HP）。战争回响难度约 ×3.6。
                  </p>
                </div>
              )}
              {settings.enemyMode === "custom" && (
                <div className="mt-2.5">
                  <FieldRow label="基础数值">
                    <Input
                      className="w-36 text-right"
                      title="血量"
                      value={settings.custom.hp}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, custom: { ...s.custom, hp: e.target.value } }))
                      }
                    />
                    <Input
                      className="w-20 text-right"
                      title="防御"
                      value={settings.custom.def}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, custom: { ...s.custom, def: e.target.value } }))
                      }
                    />
                  </FieldRow>
                  <FieldRow label="元素抗性">
                    {ELEMENTS.map(([k, label]) => (
                      <label key={k} className="flex w-[64px] flex-col gap-1">
                        <span className="text-[11px] leading-none text-[var(--sub)]">{label}</span>
                        <Input
                          className="text-center"
                          value={settings.custom.res[k]}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              custom: { ...s.custom, res: { ...s.custom.res, [k]: e.target.value } },
                            }))
                          }
                        />
                      </label>
                    ))}
                  </FieldRow>
                  <FieldRow label="失衡 / 处决">
                    <Input
                      className="w-20 text-right"
                      title="失衡上限"
                      value={settings.custom.stagger}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, custom: { ...s.custom, stagger: e.target.value } }))
                      }
                    />
                    <Input
                      className="w-20 text-right"
                      title="失衡时长 (s)"
                      value={settings.custom.breakDur}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, custom: { ...s.custom, breakDur: e.target.value } }))
                      }
                    />
                    <Input
                      className="w-20 text-right"
                      title="处决回技"
                      value={settings.custom.execSp}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, custom: { ...s.custom, execSp: e.target.value } }))
                      }
                    />
                  </FieldRow>
                  <p className="border-t border-[var(--border)] pt-2.5 text-xs leading-relaxed text-[var(--faint)]">
                    已预填常用靶子：血量 1 亿、全抗 20、失衡参数同天鼓（320/9s）；训练木桩＝0
                    抗性/极大血量。
                  </p>
                </div>
              )}
            </Section>

            {/* ── ③ 队伍配置 ── */}
            {crew.length > 0 && (
              <Section step="3" title="队伍配置" desc="只改数值与效果，不校验轴的技力/充能可行性">
                <CrewEditor crew={crew} updateCrew={updateCrew} catalog={catalog} names={names} />
              </Section>
            )}

            {/* ── ④ 面板修正 ── */}
            <Section
              step={crew.length > 0 ? "4" : "3"}
              title="面板修正"
              desc="可选 · 绝大多数情况留空"
            >
              <FieldRow label="暴击率 +">
                <Input
                  className="w-full max-w-56"
                  placeholder="如 all=3 或 last-rite=8（百分点）"
                  value={settings.crit}
                  onChange={(e) => setSettings((s) => ({ ...s, crit: e.target.value }))}
                />
              </FieldRow>
              <FieldRow label="暴伤 +">
                <Input
                  className="w-full max-w-56"
                  placeholder="如 all=20（百分点）"
                  value={settings.cdmg}
                  onChange={(e) => setSettings((s) => ({ ...s, cdmg: e.target.value }))}
                />
              </FieldRow>
              <p className="border-t border-[var(--border)] pt-2.5 text-xs leading-relaxed text-[var(--faint)]">
                条件型暴击机制（「对寒冷附着敌人暴伤+20%、冻结加倍」「强化普攻叠暴击」等）已由引擎按
                每一击命中瞬间的敌人状态自动结算，无需填写。此处仅补偿恒定的面板缺口，
                填在模拟器已算面板之上的增量。
              </p>
            </Section>

            {/* ── 运行 ── */}
            <Button
              className="h-11 w-full text-[14px] font-semibold"
              onClick={run}
              disabled={!fileText || status === "running"}
            >
              {status === "running" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在计算…
                </>
              ) : (
                "开始计算并生成 Excel 报告"
              )}
            </Button>

            {errorMsg && (
              <Notice tone="danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </Notice>
            )}
          </div>

          {/* ── 右栏：观测读数（桌面常驻粘性，窄屏出结果后跟在按钮后） ── */}
          <aside className={cn("mt-4 lg:mt-0", !asideVisible && "hidden lg:block")}>
            {/* 面板比视口高时改为内部滚动，保证底部操作按钮始终可达 */}
            <div className="lg:sticky lg:top-[76px] lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto lg:pr-0.5">
              <ResultPane result={result} status={status} />
            </div>
          </aside>
        </div>
      </main>

      <footer className="pb-6 pt-1 text-center text-[11px] text-[var(--sub)]">
        End-DPScope v1.0 · 本地运行，不上传数据 · 计算核心 Endaxis
      </footer>
    </div>
  );
}
