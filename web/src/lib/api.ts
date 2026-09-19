export interface Settings {
  enemyMode: "timeline" | "dummy" | "template" | "custom";
  custom: {
    hp: string;
    def: string;
    res: Record<string, string>;
    stagger: string;
    breakDur: string;
    execSp: string;
  };
  template: { id: string; level: string; hpmult: string };
  crit: string;
  cdmg: string;
  operators: CrewOverride[];
}

export interface CrewOverride {
  track: string;
  level?: number;
  promoted?: boolean;
  potential?: number;
  trustLevel?: number;
  talents?: Record<string, number>;
  skillLevels?: Record<string, number>;
  weapon?: {
    /** 换成同类型武器时带上的武器 slug，缺省表示沿用轴里的武器 */
    slug?: string;
    level?: number;
    tuned?: boolean;
    potential?: number;
    skill1Level?: number;
    skill2Level?: number;
    skill3Level?: number;
  };
  /** 槽位 → 装备部件与强化档；pieceId 缺省表示沿用轴里的部件 */
  gears?: Record<string, { pieceId?: string; levels?: number[] }>;
}

export interface LmdiRow {
  track: string;
  name: string;
  dmg: number;
  buff: number;
}

export interface CalcResult {
  summary: {
    totalDamage: number;
    dps: number;
    dpspHint?: number;
    rotationTime: number;
    hitCount: number;
    enemyHpLeft?: number;
    enemyConfig?: Record<string, unknown>;
  };
  meta: { scenario?: string; enemyName?: string };
  lmdi: LmdiRow[];
  stats?: {
    staggerDmg: number;
    staggerShare: number;
    staggerWindows: number;
    peakSec: number | null;
    peakDmg: number;
    perSec?: { sec: number; dmg: number }[];
  };
  warnings: string[];
  reportToken: string;
  reportName: string;
}

export async function runCalculate(
  filename: string,
  project: unknown,
  settings: Settings,
): Promise<CalcResult> {
  const res = await fetch("/api/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, project, settings }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `本地计算服务返回 ${res.status}`);
  }
  return data as CalcResult;
}

export function openReport(token: string) {
  return fetch(`/api/open?token=${token}`, { method: "POST" });
}

export function revealReport(token: string) {
  return fetch(`/api/reveal?token=${token}`, { method: "POST" });
}

/** 打开程序目录下的《功能说明.md》。 */
export async function openHelp(): Promise<void> {
  const res = await fetch("/api/help");
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new Error((d && d.error) || "打开说明失败");
  }
}

/** 桌面窗口（pywebview）暴露的原生能力；浏览器里为 undefined。 */
interface PywebviewApi {
  save_report?: (token: string) => Promise<{ saved?: string; cancelled?: boolean; error?: string }>;
}

function desktopApi(): PywebviewApi | undefined {
  return (window as unknown as { pywebview?: { api?: PywebviewApi } }).pywebview?.api;
}

export function hasDesktopSave(): boolean {
  return typeof desktopApi()?.save_report === "function";
}

/** 桌面端「另存为」：走系统保存对话框，保证 .xlsx 后缀不丢。 */
export async function saveReportAs(token: string): Promise<string> {
  const api = desktopApi();
  if (!api?.save_report) throw new Error("当前环境不支持另存为");
  const r = await api.save_report(token);
  if (r.error) throw new Error(r.error);
  if (r.cancelled) return "";
  return r.saved ?? "";
}

export function engineStatus(): Promise<{ running: boolean; local?: string; lastResult?: { ok: boolean; message: string } | null }> {
  return fetch("/api/engine/status").then(r => r.json());
}

export function engineUpdate(): Promise<{ started: boolean; running?: boolean }> {
  return fetch("/api/engine/update", { method: "POST" }).then(r => r.json());
}

export function syncNow() {
  return fetch("/api/sync/run", { method: "POST" });
}

export interface NameMaps {
  operators: Record<string, string>;
  weapons: Record<string, string>;
  enemies: Record<string, string>;
}

export async function fetchNames(): Promise<NameMaps> {
  try {
    const res = await fetch("/api/names");
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { operators: {}, weapons: {}, enemies: {} };
  }
}
