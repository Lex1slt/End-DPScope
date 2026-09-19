"""End-DPScope 本地 Web 服务：为 React 前端提供计算 API 并托管静态页面。

- 仅监听 127.0.0.1，数据不出本机。
- 只用标准库 HTTP 服务，不引入新依赖；计算/报告复用 dps_end 既有管线。
- 前端构建产物位于 web/dist（web/ 下 npm install && npm run build）。

启动：python -m dps_end.server
"""

from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

if getattr(sys, "_MEIPASS", None):
    APP_DIR = Path(sys.executable).resolve().parent
    _bundle = Path(sys._MEIPASS)  # noqa: SLF001 — PyInstaller 解包目录
else:
    APP_DIR = Path(__file__).resolve().parent.parent
    _bundle = None
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from dps_end import engine_sync, official_names, updates  # noqa: E402
from dps_end.akedata import (
    fetch_enemy, load_names, refresh_enemy_table, refresh_names,  # noqa: E402
)
from dps_end.report import write_report  # noqa: E402
from dps_end.simnode import run_simulation  # noqa: E402

WEB_DIST = _bundle / "web" / "dist" if _bundle else APP_DIR / "web" / "dist"
OUTPUT_DIR = APP_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
ELEMENTS = ("physical", "heat", "cryo", "electric", "nature")
_tokens: dict[str, Path] = {}
SYNC_STATE = APP_DIR / ".akedata_cache" / "sync_state.json"
CATALOG = (_bundle / "dps_end" / "data" / "catalog.json") if _bundle else (APP_DIR / "dps_end" / "data" / "catalog.json")
_sync_status = {"syncing": False, "lastSync": None}


def _load_sync_state() -> dict:
    try:
        return json.loads(SYNC_STATE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_sync_state(state: dict):
    try:
        SYNC_STATE.parent.mkdir(parents=True, exist_ok=True)
        SYNC_STATE.write_text(json.dumps(state), encoding="utf-8")
    except Exception:
        pass


def data_sync_worker(force: bool = False):
    """后台数据同步：名称映射每日、敌人模板表每周、官方名每周。

    force=True（「立即同步」按钮）时无视调度阈值，全量强制刷新；
    每步的结果与错误写入 _sync_status["steps"]，由 /api/sync/status 回传前端。
    """
    state = _load_sync_state()
    now = time.time()
    cache = APP_DIR / ".akedata_cache"
    steps = {}
    _sync_status["steps"] = steps

    def due(key: str, days: float) -> bool:
        return force or (now - state.get(key, 0) > days * 86400)

    def done(key: str):
        state[key] = time.time()
        steps[key] = {"ok": True, "at": state[key]}
        _save_sync_state(state)

    def fail(key: str, exc: Exception):
        steps[key] = {"ok": False, "error": str(exc)[:200]}

    if due("names", 1):
        try:
            refresh_names(cache_dir=str(cache))
            done("names")
        except Exception as exc:  # noqa: BLE001
            fail("names", exc)
    if due("official", 7):
        try:
            catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
            official_names.refresh(cache, catalog)
            done("official")
        except Exception as exc:  # noqa: BLE001
            fail("official", exc)
    if due("enemy", 7):
        try:
            if refresh_enemy_table(str(cache)):
                done("enemy")
            else:
                steps["enemy"] = {"ok": True, "note": "远端无更新"}
        except Exception as exc:  # noqa: BLE001
            fail("enemy", exc)

    _sync_status["syncing"] = False
    ok_ts = [v["at"] for v in steps.values() if v.get("ok") and v.get("at")]
    _sync_status["lastSync"] = max(ok_ts) if ok_ts else state.get("names") or state.get("enemy")
    _sync_status["lastError"] = "; ".join(
        f"{k}: {v.get('error', '')}" for k, v in steps.items() if not v.get("ok")) or None


def start_background_sync(delay: float = 1.5):
    """延后启动同步线程，避免拖慢窗口首屏。"""

    def _run():
        threading.Event().wait(delay)
        try:
            data_sync_worker()
        except Exception:
            pass

    threading.Thread(target=_run, daemon=True).start()


def _num(value, default: float) -> float:
    try:
        return float(value if value not in (None, "") else default)
    except (TypeError, ValueError):
        return float(default)


def _active_scenario(project: dict) -> dict:
    scs = project.get("scenarioList") or []
    for sc in scs:
        if sc.get("id") == project.get("activeScenarioId"):
            return sc
    return scs[0] if scs else {}


def apply_settings(project: dict, st: dict) -> tuple[dict, list[str]]:
    """与桌面版 GUI 相同的敌人/面板覆盖逻辑，返回 (新project, 警告列表)。"""
    import copy

    proj = copy.deepcopy(project)
    mode = st.get("enemyMode", "timeline")
    ce = st.get("custom") or {}
    warnings: list[str] = []

    if proj.get("__native"):
        en = proj["__native"].setdefault("enemy", {})
        if mode == "custom":
            en["hp"] = _num(ce.get("hp"), 1e9)
            en["defense"] = _num(ce.get("def"), 100)
            en["resistance"] = {k: _num(ce.get("res", {}).get(k), 0) for k in ELEMENTS}
            en["maxStagger"] = _num(ce.get("stagger"), 1e9)
            en["staggerBreakDuration"] = _num(ce.get("breakDur"), 9)
            en["finisherRecovery"] = _num(ce.get("execSp"), 50)
        elif mode == "dummy":
            en["hp"] = 1e9
            en["defense"] = _num(ce.get("def"), 100)
            en["resistance"] = {k: 0 for k in ELEMENTS}
            en["maxStagger"] = 1e9
        elif mode == "template":
            tpl = st.get("template") or {}
            if tpl.get("id"):
                en["id"] = tpl["id"]
            en["level"] = int(_num(tpl.get("level"), 90))
            en["hpMultiplier"] = _num(tpl.get("hpmult"), 1.0)
            for key in ("hp", "defense", "resistance", "maxStagger"):
                en.pop(key, None)
    else:
        sc = _active_scenario(proj)
        sysc = sc.setdefault("data", {}).setdefault("systemConstants", {})
        if mode == "dummy":
            sysc["enemyHp"] = 1e9
            sysc["resistance"] = {k: 0 for k in ELEMENTS}
            sysc["maxStagger"] = 1e9
        elif mode == "custom":
            sysc["enemyHp"] = _num(ce.get("hp"), 1e9)
            sysc["defense"] = _num(ce.get("def"), 100)
            sysc["resistance"] = {k: _num(ce.get("res", {}).get(k), 0) for k in ELEMENTS}
            sysc["maxStagger"] = _num(ce.get("stagger"), 1e9)
            sysc["staggerBreakDuration"] = _num(ce.get("breakDur"), 9) * 60
            sysc["executionRecovery"] = _num(ce.get("execSp"), 50)
        elif mode == "template":
            tpl = st.get("template") or {}
            enemy_id = (tpl.get("id") or "").strip()
            if not enemy_id:
                raise ValueError("敌人模板模式下必须填写模板 ID（如 eny_0082_hsbear）")
            level = int(_num(tpl.get("level"), 90))
            hpmult = _num(tpl.get("hpmult"), 1.0)
            tpl_data = fetch_enemy(enemy_id, level, str(APP_DIR / ".akedata_cache"))
            sysc["enemyHp"] = float(tpl_data["hp"]) * hpmult
            sysc["defense"] = float(tpl_data.get("defense") or 100)
            sysc["resistance"] = {k: float(tpl_data["resistance"].get(k, 0)) for k in ELEMENTS}
            if tpl_data.get("max_stagger"):
                sysc["maxStagger"] = float(tpl_data["max_stagger"])
            if proj.get("activeEnemyId") != enemy_id:
                proj["activeEnemyId"] = enemy_id

    # 面板修正（增量语义，与 GUI/CLI 一致）
    if proj.get("__native"):
        tracks = [t.get("id") for t in (proj["__native"].get("tracks") or [])
                  if isinstance(t, dict) and t.get("id")]
    else:
        sc = _active_scenario(proj)
        tracks = [t.get("id") for t in ((sc.get("data") or {}).get("tracks") or [])
                  if isinstance(t, dict) and t.get("id")]
    known = set(tracks)
    overrides: list[dict] = []
    for key, stat in (("crit", "critRate"), ("cdmg", "critDmg")):
        spec = (st.get(key) or "").strip().replace("，", ",")
        for part in spec.split(","):
            if "=" not in part:
                continue
            slug, val = (x.strip() for x in part.split("=", 1))
            if not val:
                continue
            try:
                num = float(val)
            except ValueError:
                warnings.append(f"面板修正「{slug}」的数值无效，已忽略")
                continue
            if slug == "all":
                overrides.extend({"track": tid, "stat": stat, "value": num} for tid in tracks)
            elif slug in known:
                overrides.append({"track": slug, "stat": stat, "value": num})
            else:
                warnings.append(f"面板修正「{slug}」没有匹配到干员，已忽略")
    if overrides:
        proj["__panelOverrides"] = overrides
    return proj, warnings


def _clamp_int(v, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return lo


def open_report(path) -> None:
    """用系统默认程序打开报告（Excel）。"""
    os.startfile(str(path))


def report_path(token: str) -> Path | None:
    """按计算返回的 token 取回报告文件；已过期/不存在返回 None。"""
    p = _tokens.get(token or "")
    return p if p and p.exists() else None


def reveal_report(path) -> None:
    """在资源管理器里定位报告文件。

    explorer 的 /select 只认 `/select,"路径"` 这一种写法：路径里带空格或中文时，
    把整段当成一个参数交给 CreateProcess 会被解析失败（表现为打开「此电脑」）。
    """
    if not path.exists():
        folder = path.parent
        subprocess.Popen(f'explorer "{folder}"')
        return
    subprocess.Popen(f'explorer /select,"{path}"')


# track 上的装备实例引用键
GEAR_SLOT_KEYS = {
    "armor": "equipArmorInstanceId",
    "gloves": "equipGlovesInstanceId",
    "kit1": "equipAccessory1InstanceId",
    "kit2": "equipAccessory2InstanceId",
}


def apply_operator_overrides(project: dict, overrides: list[dict]) -> list[str]:
    """按 track 修改导出轴中 干员/武器/装备 实例的数值与效果。

    只改数值和效果，不校验轴的技力/充能可行性（由调用方决定口径）。
    """
    sc = _active_scenario(project)
    data = sc.setdefault("data", {})
    ops_by_id = {o.get("id"): o for o in data.get("operators", []) if o.get("id")}
    wps_by_id = {w.get("id"): w for w in data.get("weapons", []) if w.get("id")}
    ges_by_id = {g.get("id"): g for g in data.get("gears", []) if g.get("id")}
    applied: list[str] = []
    for ov in overrides or []:
        track = next((t for t in data.get("tracks", [])
                      if t.get("id") == ov.get("track")), None)
        if not track:
            continue
        op = ops_by_id.get(track.get("operatorInstanceId"))
        if op:
            if ov.get("level") is not None:
                op["level"] = _clamp_int(ov["level"], 1, 90)
            if ov.get("promoted") is not None:
                op["promoted"] = bool(ov["promoted"])
            if ov.get("potential") is not None:
                op["potential"] = _clamp_int(ov["potential"], 0, 5)
            if ov.get("trustLevel") is not None:
                op["trustLevel"] = _clamp_int(ov["trustLevel"], 0, 100)
            for k, v in (ov.get("talents") or {}).items():
                op.setdefault("talentStates", {})[str(k)] = _clamp_int(v, 0, 9)
            sl = ov.get("skillLevels") or {}
            for k in ("basicAttack", "battleSkill", "comboSkill", "ultimate"):
                if sl.get(k) is not None:
                    op.setdefault("skillLevels", {})[k] = _clamp_int(sl[k], 1, 12)
        wp = wps_by_id.get(track.get("weaponInstanceId"))
        wov = ov.get("weapon") or {}
        if wp and wov:
            if wov.get("slug"):
                wp["weaponSlug"] = str(wov["slug"])
            if wov.get("level") is not None:
                wp["level"] = _clamp_int(wov["level"], 1, 90)
            if wov.get("tuned") is not None:
                wp["tuned"] = bool(wov["tuned"])
            if wov.get("potential") is not None:
                # 低星武器潜能上限 5、六星 1；这里不卡口径，交给引擎/界面提示
                wp["potential"] = _clamp_int(wov["potential"], 0, 5)
            for k in ("skill1Level", "skill2Level", "skill3Level"):
                if wov.get(k) is not None:
                    wp[k] = _clamp_int(wov[k], 0, 9)
        for slot, gv in (ov.get("gears") or {}).items():
            gid = track.get(GEAR_SLOT_KEYS.get(slot, ""))
            g = ges_by_id.get(gid)
            if not g:
                continue
            if isinstance(gv, dict):
                if gv.get("pieceId"):
                    g["gearPieceId"] = str(gv["pieceId"])
                levels = gv.get("levels")
                if isinstance(levels, list) and levels:
                    g["artificingLevels"] = [_clamp_int(x, 0, 3) for x in levels][:4]
            elif isinstance(gv, list) and gv:
                g["artificingLevels"] = [_clamp_int(x, 0, 3) for x in gv][:4]
        applied.append(track.get("id"))
    return applied


class Handler(BaseHTTPRequestHandler):
    server_version = "End-DPScope/1.0"

    def log_message(self, *args):  # 静默访问日志
        pass

    def _json(self, obj, status: int = 200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/engine/status":
            st = engine_sync.STATUS
            try:
                vf = APP_DIR / "vendor" / "endaxis" / ".dpsend_sync_version"
                local = vf.read_text(encoding="utf-8").strip()[:8] if vf.exists() else None
            except Exception:
                local = None
            return self._json({"running": st.get("running", False),
                               "lastResult": st.get("lastResult"), "local": local})
        if parsed.path == "/api/ping":
            return self._json({"ok": True})
        if parsed.path == "/api/update":
            return self._json({
                "engine": updates.check_engine(APP_DIR),
                "app": updates.check_app(),
            })
        if parsed.path == "/api/sync/status":
            return self._json({
                "syncing": _sync_status.get("syncing", False),
                "lastSync": _sync_status.get("lastSync"),
                "lastError": _sync_status.get("lastError"),
                "steps": _sync_status.get("steps"),
            })
        if parsed.path == "/api/help":
            # 程序目录下的说明文档：新手不用去翻文件夹找
            for name in ("功能说明.md", "README.md"):
                doc = APP_DIR / name
                if not doc.exists():
                    continue
                try:
                    open_report(doc)
                    return self._json({"opened": str(doc)})
                except OSError as exc:  # 没关联 .md 打开程序时把路径告诉前端
                    return self._json(
                        {"error": f"打不开 {name}（{exc}）。文件在：{doc}"}, 500
                    )
            return self._json({"error": "程序目录下没找到说明文档"}, 404)
        if parsed.path == "/api/catalog":
            try:
                catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
                # 叠加 AKEData 同步来的官方中文名（Endaxis 语言表偶有出入，官方为准）

                official = official_names.load(APP_DIR / ".akedata_cache")
                return self._json(official_names.apply(catalog, official))
            except Exception:
                return self._json({"weapons": [], "gearpieces": []})
        if parsed.path == "/api/names":
            try:
                return self._json(load_names())
            except Exception:
                return self._json({"operators": {}, "weapons": {}, "enemies": {}})
        if parsed.path in ("/api/open", "/api/reveal"):
            token = (parse_qs(parsed.query).get("token") or [""])[0]
            path = _tokens.get(token)
            if not path or not path.exists():
                return self._json({"error": "报告不存在或已过期，请重新计算"}, 404)
            if parsed.path == "/api/open":
                open_report(path)
                return self._json({"opened": True})
            reveal_report(path)
            return self._json({"revealed": True})
        if parsed.path == "/api/download":
            qs = parse_qs(parsed.query)
            path = _tokens.get((qs.get("token") or [""])[0])
            if not path or not path.exists():
                return self._json({"error": "报告不存在或已过期，请重新计算"}, 404)
            data = path.read_bytes()
            self.send_response(200)
            self.send_header(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            self.send_header("Content-Length", str(len(data)))
            self.send_header(
                "Content-Disposition", f"attachment; filename*=UTF-8''{quote(path.name)}"
            )
            self.end_headers()
            self.wfile.write(data)
            return
        return self._static(parsed.path)

    def _static(self, req_path: str):
        if req_path == "/":
            req_path = "/index.html"
        file = (WEB_DIST / req_path.lstrip("/")).resolve()
        try:
            inside = file.relative_to(WEB_DIST.resolve()) is not None
        except ValueError:
            inside = False
        if not inside or not file.exists():
            file = WEB_DIST / "index.html"  # SPA 兜底
        if not file.exists():
            body = "前端尚未构建：请在 web/ 目录执行 npm install && npm run build".encode("utf-8")
            self.send_response(503)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        ctype = mimetypes.guess_type(str(file))[0] or "application/octet-stream"
        data = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/api/open", "/api/reveal"):
            token = (parse_qs(urlparse(self.path).query).get("token") or [""])[0]
            path = _tokens.get(token)
            if not path or not path.exists():
                return self._json({"error": "报告不存在或已过期，请重新计算"}, 404)
            if urlparse(self.path).path == "/api/open":
                open_report(path)
                return self._json({"opened": True})
            reveal_report(path)
            return self._json({"revealed": True})
        if path == "/api/engine/update":

            if engine_sync.STATUS["running"]:
                return self._json({"started": False, "running": True})
            engine_sync.update_async(APP_DIR)
            return self._json({"started": True})
        if path == "/api/engine/status":

            st = engine_sync.STATUS
            try:
                local = (APP_DIR / "vendor" / "endaxis" / ".dpsend_sync_version")
                local = local.read_text(encoding="utf-8").strip()[:8] if local.exists() else None
            except Exception:
                local = None
            return self._json({"running": st.get("running", False),
                               "lastResult": st.get("lastResult"),
                               "local": local})
        if path == "/api/sync/run":
            if not _sync_status["syncing"]:
                _sync_status["syncing"] = True
                threading.Thread(target=data_sync_worker, kwargs={"force": True},
                                 daemon=True).start()
            return self._json({"started": True})
        if path != "/api/calculate":
            return self._json({"error": "not found"}, 404)
        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            project = payload["project"]
            settings = payload.get("settings") or {}
            filename = os.path.basename(payload.get("filename") or "排轴.json")

            proj, warnings = apply_settings(project, settings)
            crew = settings.get("operators") or []
            if crew:
                apply_operator_overrides(proj, crew)
                # 练度（尤其技能等级）变了，让 harness 按新等级重解各段倍率
                proj["__recomputeMultipliers"] = True
            sim = run_simulation(proj, source_path=filename)
            names = load_names()
            out_path = OUTPUT_DIR / f"{Path(filename).stem}_DPS报告.xlsx"
            write_report(sim, proj, str(out_path), names)
            token = uuid.uuid4().hex
            _tokens[token] = out_path

            op_names = names.get("operators", {})
            lmdi = [
                {
                    "track": row.get("track"),
                    "name": op_names.get(row.get("track"), row.get("track")),
                    "dmg": row.get("dmg", 0),
                    "buff": row.get("buff", 0),
                }
                for row in (sim.get("summary", {}).get("lmdi") or [])
            ]
            lmdi.sort(key=lambda r: -r["buff"])
            summary = sim.get("summary", {})
            sp_cost = sum(
                -s["sp"] for s in sim.get("spLog", [])
                if s.get("kind") == "SP_CHANGE" and (s.get("sp") or 0) < 0
            )
            total = summary.get("totalDamage", 0)
            summary["dpspHint"] = (total / sp_cost * 100) if sp_cost else 0  # 每格技力（100点）

            # 深度玩家统计：失衡窗口利用 + 峰值秒
            direct = [h for h in sim.get("hits", [])
                      if h.get("direct") and (h.get("exp") or 0) > 0]
            windows: list[tuple[float, float]] = []
            cur_start = None
            for h in sorted(direct, key=lambda x: x["t"]):
                b = bool((h.get("enemyState") or {}).get("broken"))
                if b and cur_start is None:
                    cur_start = h["t"]
                elif not b and cur_start is not None:
                    windows.append((cur_start, h["t"]))
                    cur_start = None
            if cur_start is not None and direct:
                windows.append((cur_start, direct[-1]["t"]))
            dmg_in = sum(
                h["exp"] for h in direct
                if any(a <= h["t"] <= b for a, b in windows)
            )
            per_sec: dict[int, float] = {}
            for h in direct:
                per_sec[int(h["t"])] = per_sec.get(int(h["t"]), 0.0) + h["exp"]
            peak_sec, peak_dmg = (
                max(per_sec.items(), key=lambda kv: kv[1]) if per_sec else (None, 0.0)
            )
            stats = {
                "staggerDmg": dmg_in,
                "staggerShare": dmg_in / total if total else 0,
                "staggerWindows": len(windows),
                "peakSec": peak_sec,
                "peakDmg": peak_dmg,
                "perSec": [{"sec": k, "dmg": v} for k, v in sorted(per_sec.items())],
            }
            return self._json({
                "summary": summary,
                "meta": sim.get("meta", {}),
                "lmdi": lmdi,
                "stats": stats,
                "warnings": warnings,
                "reportToken": token,
                "reportName": out_path.name,
            })
        except Exception as exc:  # noqa: BLE001
            import traceback

            return self._json(
                {"error": f"{exc}", "detail": traceback.format_exc()[-1500:]}, 500
            )


def main():
    port = int(os.environ.get("DPSEND_PORT", "8686"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    start_background_sync()
    url = f"http://127.0.0.1:{port}"
    print(f"End-DPScope Web 界面已启动：{url}  (Ctrl+C 退出)")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
