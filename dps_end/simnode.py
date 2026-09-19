"""调用内置的 Endaxis 模拟器（vendor/endaxis，Node实现）计算排轴伤害。

流程：项目JSON（可选敌人覆盖参数）→ 临时输入文件 → vite-node 运行 dpsend-harness.ts
→ 读取输出（逐hit明细、LMDI归因、SP/能量流水、汇总指标）。
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# PyInstaller打包模式下，从exe所在目录找vendor/endaxis
if getattr(sys, '_MEIPASS', None):
    PKG_ROOT = Path(sys.executable).resolve().parent
else:
    PKG_ROOT = Path(__file__).resolve().parent.parent
VENDOR_DIR = PKG_ROOT / "vendor" / "endaxis"
HARNESS = "dpsend-harness.ts"


class SimulationError(RuntimeError):
    pass


def bundled_node() -> Path | None:
    """随包分发的便携版 Node（安装包自带，用户无需自行安装）。"""
    for name in ("node.exe", "node"):
        cand = PKG_ROOT / "runtime" / name
        if cand.exists():
            return cand
    return None


def _node_bin() -> str:
    node = bundled_node()
    if node:
        return str(node)
    found = shutil.which("node")
    if not found:
        raise SimulationError(
            "未找到 Node 运行环境：程序目录下应有 runtime/node.exe，"
            "或在本机安装 Node.js 20+ 后重试")
    return found


def apply_enemy_overrides(project: dict, args) -> dict:
    """按CLI参数修改项目敌人配置（深拷贝后返回）。"""
    import copy

    proj = copy.deepcopy(project)
    if proj.get("__native"):
        # 原生配置模式：敌人已在配置内，仅处理校准覆盖
        native = proj["__native"]
        cal = getattr(args, "crit_rate", None)
        if cal:
            native.setdefault("calibration", {})
            for part in str(cal).split(","):
                if "=" in part:
                    slug, v = part.split("=", 1)
                    native["calibration"].setdefault(slug.strip(), {})["critRate"] = float(v)
        cal_dmg = getattr(args, "crit_dmg", None)
        if cal_dmg:
            native.setdefault("calibration", {})
            for part in str(cal_dmg).split(","):
                if "=" in part:
                    slug, v = part.split("=", 1)
                    native["calibration"].setdefault(slug.strip(), {})["critDmg"] = float(v)
        return proj

    scenarios = proj.get("scenarioList") or []
    if not scenarios:
        raise SimulationError("项目缺少 scenarioList")
    active = proj.get("activeScenarioId")
    sc = next((s for s in scenarios if s.get("id") == active), scenarios[0])
    data = sc.setdefault("data", {})
    sysc = data.setdefault("systemConstants", {})

    enemy_mode = getattr(args, "enemy", "dummy")
    if enemy_mode == "dummy":
        sysc["enemyHp"] = float(getattr(args, "enemy_hp", 0) or 1e9)
        sysc["resistance"] = {"physical": 0, "heat": 0, "cryo": 0, "electric": 0, "nature": 0}
        sysc["maxStagger"] = float(getattr(args, "stagger_cap", 0) or 1e9)
        sysc["staggerBreakDuration"] = float(getattr(args, "break_duration", 540))
        sysc["executionRecovery"] = float(getattr(args, "exec_sp", 50))
    elif enemy_mode.startswith("eny_") or enemy_mode.startswith("eny"):
        # AKEData 敌人模板：按ID设置敌人与属性
        from .akedata import fetch_enemy

        preset = fetch_enemy(enemy_mode, getattr(args, "enemy_level", 90), args.cache)
        proj["activeEnemyId"] = enemy_mode
        sysc["enemyHp"] = float(getattr(args, "enemy_hp", 0) or preset["hp"])
        sysc["resistance"] = {k: float(v) for k, v in preset["resistance"].items()
                              if k in ("physical", "heat", "cryo", "electric", "nature")}
        cap = getattr(args, "stagger_cap", None)
        sysc["maxStagger"] = float(cap) if cap else (preset.get("max_stagger") or 1e9)
        sysc["staggerBreakDuration"] = float(getattr(args, "break_duration", 540))
    # enemy_mode == "timeline": 保持项目配置不变

    # 面板修正：在模拟器算出的面板之上追加暴击/攻击（增量，百分点）
    overrides = []

    def _parse_pairs(spec):
        out = {}
        for part in str(spec or "").replace("，", ",").split(","):
            if "=" in part:
                slug, v = part.split("=", 1)
                if v.strip():
                    out[slug.strip()] = float(v)
        return out

    all_ids = [t.get("id") for t in data.get("tracks", []) if t.get("id")]
    for spec, stat in ((getattr(args, "crit_rate", None), "critRate"),
                       (getattr(args, "crit_dmg", None), "critDmg"),
                       (getattr(args, "atk_pct", None), "atkPercent")):
        for slug, v in _parse_pairs(spec).items():
            if slug == "all":
                overrides.extend({"track": tid, "stat": stat, "value": v} for tid in all_ids)
            else:
                overrides.append({"track": slug, "stat": stat, "value": v})
    if overrides:
        proj["__panelOverrides"] = overrides

    if getattr(args, "enemy_def", None) is not None:
        sysc["defense"] = float(args.enemy_def)
    if getattr(args, "enemy_res", None):
        res = sysc.setdefault("resistance", {})
        for part in str(args.enemy_res).split(","):
            if "=" in part:
                k, v = part.split("=", 1)
                res[k.strip()] = float(v)
    return proj


def run_simulation(project: dict, out_dir: str | None = None,
                   source_path: str | None = None) -> dict:
    """运行Endaxis模拟器，返回harness输出dict。"""
    if not VENDOR_DIR.exists():
        raise SimulationError(
            f"未找到内置模拟器目录 {VENDOR_DIR}（应包含 dpsend-harness.ts 与 node_modules）")
    out_dir = out_dir or tempfile.mkdtemp(prefix="dpsend_")
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    in_path = out_dir / "dpsend_input.json"
    out_path = out_dir / "dpsend_sim_out.json"
    in_path.write_text(json.dumps(project, ensure_ascii=False), encoding="utf-8")

    vite_node = VENDOR_DIR / "node_modules" / "vite-node" / "dist" / "cli.mjs"
    if not vite_node.exists():
        raise SimulationError("vendor/endaxis 未安装依赖，请运行「首次运行环境检查.bat」")
    # 用计算专用配置：不加载 Vue 插件，运行依赖从 299MB 降到 ~45MB
    config = VENDOR_DIR / "dpsend.vite.config.ts"
    cmd = [_node_bin(), str(vite_node)]
    if config.exists():
        cmd += ["--config", config.name]
    cmd += [HARNESS, str(in_path), str(out_path)]
    proc = subprocess.run(cmd, cwd=str(VENDOR_DIR), capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=600)
    if proc.returncode != 0:
        raise SimulationError("模拟器运行失败：\n" + (proc.stderr or proc.stdout)[-2000:])
    if not out_path.exists():
        raise SimulationError("模拟器未产生输出：\n" + (proc.stderr or proc.stdout)[-2000:])
    sim = json.loads(out_path.read_text(encoding="utf-8"))
    meta = sim.setdefault("meta", {})
    if source_path:
        meta["source"] = str(source_path)
        try:
            from .parser import pick_scenario

            meta["scenario"] = pick_scenario(project).get("name") or meta.get("scenario")
        except Exception:
            pass
    return sim
