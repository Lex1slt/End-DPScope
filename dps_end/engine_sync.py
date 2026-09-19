"""计算核心自更新（随包内置）：下载上游 → 打 DPS-END 补丁 → 冒烟 → 切换。

与开发脚本 sync_endaxis.py 同一套语义，但只依赖随包发布的内容
（bundled node + dpsend-harness.ts 自检），供桌面端「一键更新」使用。
"""

from __future__ import annotations

import json
import shutil
import tarfile
import tempfile
import time
import urllib.request
from pathlib import Path

ENGINE_REPO = "Lieyuan621/Endaxis"
CUSTOM_FILES = [
    "dpsend-harness.ts",
    "dpsend-native.ts",
    "dpsend.vite.config.ts",
    "dpsend-elementplus-locale-stub.ts",
    "dpsend-runtime.package.json",
]
PATCH_ANCHOR = (
    "      const enemyEntries = [...ctx.state.enemy.enemyStatusEffects.values()].filter(\n"
    "        // Inclusive at expiresAt: same-timestamp derived hits (e.g. onStatusExpire\n"
    "        // damage) must still see sibling debuffs that share the expiry time.\n"
    "        entry => e.time <= entry.expiresAt,\n"
    "      );"
)
PATCH_SNAPSHOT = PATCH_ANCHOR + """
      // DPS-END: snapshot the live enemy state at hit time (attach stacks / debuffs / broken).
      try {
        const _inf = (ctx.state.enemy as any).infliction as any;
        (hit as any)._enemyState = {
          infliction: _inf && e.time < _inf.expiresAt
            ? { element: _inf.element, stacks: _inf.stacks } as any
            : null,
          debuffs: enemyEntries
            .filter((en: any) => en.stat?.modifier)
            .map((en: any) => ({ id: en.id, stat: en.stat?.modifier, value: (en.value ?? 0) * (en.stacks ?? 1) })),
          broken: staggerMult > 1,
          stagger: (ctx.state.enemy as any).stagger,
          maxStagger: (ctx.state.enemy as any).config?.maxStagger,
        };
      } catch { /* snapshot is best-effort */ }"""

STATUS = {"running": False, "lastResult": None, "lastError": None}


ALLOWED_FETCH_HOSTS = ("codeload.github.com", "github.com", "api.github.com")


def _fetch(url: str, timeout: int = 300) -> bytes:
    import ipaddress
    import socket
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_FETCH_HOSTS:
        raise ValueError(f"拒绝请求非白名单域名: {parsed.hostname}")
    for info in socket.getaddrinfo(parsed.hostname, 443):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError(f"域名解析到受限地址: {ip}")
    req = urllib.request.Request(url, headers={"User-Agent": "dps-end/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _remote_sha() -> str | None:
    """上游最新 commit：优先 atom feed（不占限额），失败再走 API。"""
    try:
        req = urllib.request.Request(
            f"https://github.com/{ENGINE_REPO}/commits/main.atom",
            headers={"User-Agent": "dps-end/1.0"})
        import re
        xml = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "replace")
        m = re.search(r"/commit/([0-9a-f]{40})", xml)
        if m:
            return m.group(1)
    except Exception:
        pass
    try:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{ENGINE_REPO}/commits/main",
            headers={"User-Agent": "dps-end/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return str(json.loads(r.read()).get("sha", "")) or None
    except Exception:
        return None


def _apply_patches(vendor: Path) -> int:
    handler = vendor / "src" / "simulation" / "events" / "HitHandler.ts"
    if not handler.exists():
        return 0
    content = handler.read_text(encoding="utf-8")
    if "_enemyState" in content:
        return 1
    count = content.count(PATCH_ANCHOR)
    if count == 0:
        return -1
    handler.write_text(content.replace(PATCH_ANCHOR, PATCH_SNAPSHOT), encoding="utf-8")
    return count


def _smoke_ok(app_dir: Path, vendor: Path) -> bool:
    """用最小 __native 配置直跑一次 harness，确认计算链路可用。"""
    try:
        from .simnode import bundled_node

        node = bundled_node()
        if node is None:
            import shutil as _sh
            node = _sh.which("node")
        if not node:
            return False
        cfg = {
            "__native": {
                "name": "engine-smoke",
                "durationSec": 30,
                "prepSec": 0,
                "enemy": {"id": "eny_0082_hsbear", "level": 90, "hpMultiplier": 1.0},
                "operators": [{
                    "operator": "last-rite", "level": 90, "promoted": True, "potential": 0,
                    "skillLevels": {"basicAttack": 12, "battleSkill": 12, "comboSkill": 12, "ultimate": 12},
                    "weapon": {"slug": "khravengger", "level": 90, "tuned": True,
                                "skill1Level": 9, "skill2Level": 9, "skill3Level": 4},
                    "rotation": [
                        {"skill": "battleSkill", "at": 1},
                        {"skill": "ultimate", "at": 3},
                    ],
                }],
            }
        }
        d = Path(tempfile.mkdtemp(prefix="dpsend_upd_"))
        (d / "in.json").write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
        cli = vendor / "node_modules" / "vite-node" / "dist" / "cli.mjs"
        if not cli.exists():
            return False
        import subprocess
        proc = subprocess.run(
            [str(node), str(cli), "--config", "dpsend.vite.config.ts",
             "dpsend-harness.ts", str(d / "in.json"), str(d / "out.json")],
            cwd=str(vendor), capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=300)
        out = d / "out.json"
        if proc.returncode != 0 or not out.exists():
            return False
        total = json.loads(out.read_text(encoding="utf-8")).get("summary", {}).get("totalDamage", 0)
        return total > 0
    except Exception:
        return False


def update_engine(app_dir: Path) -> dict:
    """一键更新计算核心。返回 {ok, from, to, message}。"""
    app_dir = Path(app_dir)
    vendor = app_dir / "vendor" / "endaxis"
    version_file = vendor / ".dpsend_sync_version"
    local = version_file.read_text(encoding="utf-8").strip() if version_file.exists() else None
    remote = _remote_sha()
    if not remote:
        return {"ok": False, "message": "无法连接 GitHub，请稍后重试"}
    if local and remote.startswith(local):
        return {"ok": True, "message": "计算核心已是最新", "from": local, "to": remote[:8]}

    backup = app_dir / "vendor" / "endaxis_backup"
    if backup.exists():
        shutil.rmtree(backup, ignore_errors=True)
    shutil.copytree(vendor, backup,
                    ignore=shutil.ignore_patterns("node_modules", "output"))
    try:
        data = _fetch(f"https://codeload.github.com/{ENGINE_REPO}/tar.gz/{remote}", timeout=600)
        tf = Path(tempfile.mkdtemp(prefix="dpsend_dl_")) / "up.tar.gz"
        tf.write_bytes(data)
        extract = tf.parent / "src_upstream"
        with tarfile.open(tf, "r:gz") as t:
            t.extractall(extract)
        root = next((p for p in extract.iterdir() if p.is_dir()))
        # 覆盖 src/ 与配置，保留 DPS-END 自有文件与 node_modules
        for name in ("src", "index.html", "tsconfig.json", "tsconfig.app.json",
                     "tsconfig.node.json", "vite.config.ts", "package.json"):
            src = root / name
            if not src.exists():
                continue
            dst = vendor / name
            if src.is_dir():
                if dst.exists():
                    shutil.rmtree(dst, ignore_errors=True)
                shutil.copytree(src, dst)
            else:
                dst.write_bytes(src.read_bytes())
        patches = _apply_patches(vendor)
        if patches < 0:
            raise RuntimeError("上游 HitHandler.ts 结构变化，补丁锚点失效")
        if not _smoke_ok(app_dir, vendor):
            raise RuntimeError("更新后冒烟测试未通过")
        version_file.write_text(remote, encoding="utf-8")
        shutil.rmtree(backup, ignore_errors=True)
        return {"ok": True, "message": f"计算核心已更新到 {remote[:8]}", "from": local, "to": remote[:8]}
    except Exception as exc:
        # 回滚 src 与配置
        try:
            src = vendor / "src"
            if src.exists():
                shutil.rmtree(src, ignore_errors=True)
            bsrc = backup / "src"
            if bsrc.exists():
                shutil.copytree(bsrc, src)
            for f in CUSTOM_FILES:
                if (backup / f).exists():
                    shutil.copy2(backup / f, vendor / f)
        except Exception:
            pass
        return {"ok": False, "message": f"更新失败已回滚：{exc}", "from": local, "to": remote[:8]}


def update_async(app_dir: Path):
    """后台线程执行更新，结果写入 STATUS。"""
    import threading

    def run():
        STATUS["running"] = True
        try:
            STATUS["lastResult"] = update_engine(app_dir)
            STATUS["lastError"] = None
        except Exception as exc:
            STATUS["lastError"] = str(exc)
        finally:
            STATUS["running"] = False
            STATUS["finishedAt"] = time.time()

    threading.Thread(target=run, daemon=True).start()
