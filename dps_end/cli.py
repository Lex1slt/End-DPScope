"""DPS-END 命令行入口。

用法:
  python -m dps_end report <排轴.json> [-o 输出.xlsx] [选项]
  python -m dps_end dump   <排轴.json>                 # 预览排轴结构
  python -m dps_end refresh-names [--cache 目录]       # 从 AKEData 更新干员/敌人中文名
"""

from __future__ import annotations

import argparse
import json
import sys

from . import __version__
from .akedata import load_names, refresh_names
from .parser import load_json
from .report import write_report
from .simnode import apply_enemy_overrides, run_simulation


def cmd_report(args) -> int:
    project = load_json(args.input)
    project = apply_enemy_overrides(project, args)
    sim = run_simulation(project, source_path=args.input)
    names = {} if args.no_akedata else load_names()
    out = args.output or (args.input.rsplit(".", 1)[0] + "_DPS报告.xlsx")
    write_report(sim, project, out, names)
    s = sim.get("summary", {})
    print(f"✔ 已生成: {out}")
    print(f"  总伤害(期望) {s.get('totalDamage', 0):,} | "
          f"DPS {s.get('dps', 0):,.1f} | 循环时间 {s.get('rotationTime', 0):.2f}s | "
          f"命中 {s.get('hitCount', 0)}")
    if s.get("enemyHpLeft") is not None:
        left = s["enemyHpLeft"]
        if left <= 0:
            print(f"  ✔ 敌人已被击杀（剩余血量 {left:,.0f}）")
        else:
            print(f"  · 敌人剩余血量 {left:,.0f}")
    return 0


def cmd_dump(args) -> int:
    project = load_json(args.input)
    scenarios = project.get("scenarioList") or []
    sc = next((s for s in scenarios if s.get("id") == project.get("activeScenarioId")),
              scenarios[0] if scenarios else {})
    data = sc.get("data", {})
    print(f"方案: {sc.get('name')}  敌人: {project.get('activeEnemyId')} "
          f"时长: {data.get('battleDuration', 0) / 60:.0f}s  "
          f"干员轨: {len(data.get('tracks', []))}  "
          f"动作: {sum(len(t.get('actions', [])) for t in data.get('tracks', []))}")
    for t in data.get("tracks", []):
        panel = t.get("stats", {})
        print(f"\n[{t.get('id')}] 攻击 {panel.get('attack', 0):g}  "
              f"暴击 {panel.get('crit_rate', 0):g}%/{panel.get('crit_dmg', 0):g}%  "
              f"充能效率 {t.get('gaugeEfficiency', 100):g}%")
        for a in t.get("actions", []):
            hs = "; ".join(("—" if h.get("multiplier") is None else f"{h['multiplier']:g}%")
                           for h in a.get("hits", [])) or "(无命中)"
            print(f"  {a.get('startTime', 0) / 60:7.2f}s {a.get('type', ''):<12} "
                  f"{a.get('name', ''):<10} sp={a.get('spCost', 0):g} "
                  f"gauge={a.get('gaugeCost', 0):g} hits=[{hs}]")
    return 0


def cmd_refresh_names(args) -> int:
    names = refresh_names(cache_dir=args.cache)
    print(f"✔ 名称映射已更新: 干员 {len(names['operators'])} 个, "
          f"敌人 {len(names['enemies'])} 个")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="dps_end", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--version", action="version", version=f"dps-end {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)

    pr = sub.add_parser("report", help="排轴JSON -> Excel伤害报告")
    pr.add_argument("input", help="Endaxis排轴JSON路径")
    pr.add_argument("-o", "--output", help="输出xlsx路径（默认与输入同名_DPS报告.xlsx）")
    pr.add_argument("--enemy", default="dummy",
                    help="dummy=默认木桩(0抗性/极大血量,默认); timeline=使用排轴内置敌人配置; "
                         "或敌人模板ID（属性读取AKEData缓存，如 eny_0082_hsbear）")
    pr.add_argument("--enemy-level", type=int, default=90)
    pr.add_argument("--enemy-hp", type=float, help="覆盖敌人HP")
    pr.add_argument("--enemy-def", type=float, help="覆盖敌人防御")
    pr.add_argument("--enemy-res", help="覆盖抗性，如 cryo=0,heat=20")
    pr.add_argument("--stagger-cap", type=float, help="失衡值上限覆盖")
    pr.add_argument("--break-duration", type=float, default=540, help="失衡持续时间（帧）")
    pr.add_argument("--exec-sp", type=float, default=50, help="处决技力恢复")
    pr.add_argument("--cache", default=".akedata_cache", help="AKEData表格缓存目录")
    pr.add_argument("--crit-rate", help="面板修正：在模拟器面板之上追加暴击率（百分点），"
                                        "如 all=3 或 last-rite=8,tangtang=3")
    pr.add_argument("--crit-dmg", help="面板修正：追加暴击伤害（百分点），如 all=20")
    pr.add_argument("--atk-pct", help="面板修正：追加攻击力（百分点），如 last-rite=10")
    pr.add_argument("--no-akedata", action="store_true", help="不读取名称映射（纯slug显示）")
    pr.set_defaults(func=cmd_report)

    pd = sub.add_parser("dump", help="预览排轴解析结果")
    pd.add_argument("input")
    pd.set_defaults(func=cmd_dump)

    pn = sub.add_parser("refresh-names", help="从 AKEData 更新中文名称映射")
    pn.add_argument("--cache", default=".akedata_cache")
    pn.set_defaults(func=cmd_refresh_names)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
