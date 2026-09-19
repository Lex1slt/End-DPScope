"""同步 Endaxis 上游更新到 vendor/endaxis。

用法:
  python sync_endaxis.py           # 拉取最新 Endaxis 并更新
  python sync_endaxis.py --check   # 仅检查上游是否有更新

流程:
  1. 查询 GitHub API 获取上游最新 commit
  2. 与本地记录比对，如有更新则下载
  3. 备份当前 vendor/endaxis
  4. 解压新版 src/ + 配置文件，保留 node_modules
  5. 重新应用 DPS-END 补丁（HitHandler 敌方状态快照等）
  6. 保留 DPS-END 自定义文件（dpsend-harness.ts / dpsend-native.ts）
  7. 运行回归测试（与上次结果比对）
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENDOR = ROOT / "vendor" / "endaxis"
UPSTREAM_REPO = "Lieyuan621/Endaxis"
UPSTREAM_BRANCH = "main"
LOCAL_VERSION_FILE = VENDOR / ".dpsend_sync_version"
PATCH_FILE = ROOT / "patches" / "endaxis_dpsend.patch"
CUSTOM_FILES = [
    "dpsend-harness.ts",
    "dpsend-native.ts",
    "dpsend.vite.config.ts",
    "dpsend-elementplus-locale-stub.ts",
    "dpsend-runtime.package.json",
]

# 可选：设置环境变量 GITHUB_TOKEN（公共仓库只读不需要任何 scope）后，
# GitHub API 限额从匿名 60 次/小时/IP 提升到 5000 次/小时。
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")


def _api_headers() -> dict:
    h = {"Accept": "application/vnd.github+json", "User-Agent": "dps-end/1.0"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h

# HitHandler 补丁标记（用于检测补丁是否已应用）
PATCH_MARKERS = [
    "DPS-END: snapshot the live enemy state at hit time",
]


ALLOWED_FETCH_HOSTS = ("codeload.github.com", "github.com", "api.github.com",
                       "raw.githubusercontent.com", "objects.githubusercontent.com")


def _fetch(url: str, timeout: int = 60) -> bytes:
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_FETCH_HOSTS:
        raise ValueError(f"拒绝请求非白名单域名: {parsed.hostname}")
    req = urllib.request.Request(url, headers={"User-Agent": "dps-end/0.2"})
    return urllib.request.urlopen(req, timeout=timeout).read()


def get_local_version() -> str | None:
    if LOCAL_VERSION_FILE.exists():
        return LOCAL_VERSION_FILE.read_text().strip()
    return None


def get_remote_version() -> str | None:
    # 首选 GitHub API；403（匿名 60/h 限额耗尽）时回退 commits atom feed。
    # atom feed 与 codeload 直连都不占 api.github.com 的限额池。
    try:
        url = f"https://api.github.com/repos/{UPSTREAM_REPO}/commits/{UPSTREAM_BRANCH}"
        req = urllib.request.Request(url, headers=_api_headers())
        d = json.loads(urllib.request.urlopen(req, timeout=30).read())
        return d["sha"]
    except Exception as e:
        reset = None
        headers = getattr(e, "headers", None)
        if headers:
            try:
                reset = int(headers.get("x-ratelimit-reset") or 0) or None
            except ValueError:
                reset = None
        hint = f"（限额 {time.strftime('%H:%M', time.localtime(reset))} 重置）" if reset else ""
        print(f"⚠ GitHub API 查询失败{hint}: {e}，改用 commits atom feed")

    try:
        url = f"https://github.com/{UPSTREAM_REPO}/commits/{UPSTREAM_BRANCH}.atom"
        req = urllib.request.Request(url, headers={"User-Agent": "dps-end/1.0"})
        xml = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
        m = re.search(r"/commit/([0-9a-f]{40})", xml)
        if not m:
            print("⚠ atom feed 里没解析到 commit sha")
            return None
        return m.group(1)
    except Exception as e:
        print(f"⚠ 无法查询GitHub: {e}")
        return None


def is_patched() -> bool:
    handler = VENDOR / "src" / "simulation" / "events" / "HitHandler.ts"
    if not handler.exists():
        return False
    content = handler.read_text(encoding="utf-8")
    return all(marker in content for marker in PATCH_MARKERS)


def apply_patches():
    """重新应用 DPS-END 对 Endaxis 源码的补丁。"""
    handler = VENDOR / "src" / "simulation" / "events" / "HitHandler.ts"
    if not handler.exists():
        print("  ⚠ HitHandler.ts 不存在，跳过补丁")
        return

    content = handler.read_text(encoding="utf-8")
    if all(marker in content for marker in PATCH_MARKERS):
        print("  ✓ 补丁已应用")
        return

    # HitHandler 敌方状态快照补丁
    anchor = (
        "      const enemyEntries = [...ctx.state.enemy.enemyStatusEffects.values()].filter(\n"
        "        // Inclusive at expiresAt: same-timestamp derived hits (e.g. onStatusExpire\n"
        "        // damage) must still see sibling debuffs that share the expiry time.\n"
        "        entry => e.time <= entry.expiresAt,\n"
        "      );"
    )
    snapshot = anchor + """
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

    count = content.count(anchor)
    if count == 0:
        print("  ⚠ HitHandler.ts 锚点未找到，上游可能已改结构，需要手动检查")
        return
    content = content.replace(anchor, snapshot)
    handler.write_text(content, encoding="utf-8")
    print(f"  ✓ HitHandler.ts 补丁已应用（{count} 处）")


def download_and_extract(sha: str):
    """下载上游tarball并解压src/及配置文件到vendor/endaxis。"""
    # codeload 直连 tarball：与 api.github.com 的 tarball 端点内容相同，
    # 但不占 GitHub API 匿名 60/h 限额
    url = f"https://codeload.github.com/{UPSTREAM_REPO}/tar.gz/{sha}"
    print(f"  下载 {url}...")
    data = _fetch(url, timeout=300)

    tmp = Path(tempfile.mkdtemp(prefix="endaxis_sync_"))
    tar_path = tmp / "endaxis.tar.gz"
    tar_path.write_bytes(data)

    print("  解压...")
    with tarfile.open(tar_path, "r:gz") as tf:
        tf.extractall(tmp)

    # 找解压后的根目录
    extracted = next((tmp / d for d in os.listdir(tmp) if (tmp / d / "src").exists()), None)
    if not extracted:
        raise RuntimeError("解压后找不到 src/ 目录")

    # 保留自定义文件和node_modules
    preserve = {}
    for f in CUSTOM_FILES:
        src = VENDOR / f
        if src.exists():
            preserve[f] = src.read_text(encoding="utf-8")

    node_modules = VENDOR / "node_modules"
    nm_backup = None
    if node_modules.exists():
        nm_backup = Path(tempfile.mkdtemp(prefix="endaxis_nm_")) / "node_modules"
        print("  备份 node_modules...")
        shutil.move(str(node_modules), str(nm_backup))

    # 清除旧src
    src_dir = VENDOR / "src"
    if src_dir.exists():
        shutil.rmtree(src_dir)

    # 复制新文件
    print("  复制新版文件...")
    for item in ["src", "src/i18n", "public", "index.html",
                 "package.json", "tsconfig.json", "tsconfig.app.json",
                 "vite.config.ts"]:
        src = extracted / item
        dst = VENDOR / item
        if src.is_dir():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        elif src.exists():
            shutil.copy2(src, dst)

    # 恢复自定义文件
    for f, content in preserve.items():
        (VENDOR / f).write_text(content, encoding="utf-8")

    # 恢复node_modules
    if nm_backup and nm_backup.exists():
        shutil.move(str(nm_backup), str(node_modules))

    shutil.rmtree(tmp)

    # 记录版本
    LOCAL_VERSION_FILE.write_text(sha)
    print(f"  ✓ 已更新到 {sha[:8]}")


def run_regression_check() -> bool:
    """运行回归测试：用示例排轴跑一遍并输出总伤害。"""
    test_input = ROOT / "Endaxis_Timeline_2026-09-13.json"
    if not test_input.exists():
        print("  ⚠ 无测试排轴文件，跳过回归检查")
        return True
    try:
        vite_node = VENDOR / "node_modules" / "vite-node" / "dist" / "cli.mjs"
        if not vite_node.exists():
            print("  ⚠ node_modules 不存在，跳过回归检查")
            return True
        out = os.path.join(tempfile.mkdtemp(prefix="dpsend_regress_"), "regress_out.json")
        cfg = VENDOR / "dpsend.vite.config.ts"
        cmd = ["node", str(vite_node)]
        if cfg.exists():
            cmd += ["--config", cfg.name]
        cmd += ["dpsend-harness.ts", str(test_input), out]
        proc = subprocess.run(
            cmd, cwd=str(VENDOR), capture_output=True, text=True, timeout=300,
            encoding="utf-8", errors="replace",
        )
        if proc.returncode == 0 and os.path.exists(out):
            result = json.loads(open(out, encoding="utf-8").read())
            total = result.get("summary", {}).get("totalDamage", 0)
            print(f"  ✓ 回归测试通过: 总伤害 {total:,}")
            os.unlink(out)
            return True
        else:
            print(f"  ✗ 回归测试失败: {(proc.stderr or proc.stdout)[-500:]}")
            return False
    except Exception as e:
        print(f"  ✗ 回归测试异常: {e}")
        return False


def npm_install():
    """安装/更新依赖。

    注意：上游 package.json 会拖进 echarts / element-plus / typescript 等约 299MB
    的前端开发依赖，而计算 harness 完全用不到。这里改用最小依赖清单
    dpsend-runtime.package.json（约 45MB）。
    """
    package_json = VENDOR / "package.json"
    if not package_json.exists():
        return
    runtime_pkg = VENDOR / "dpsend-runtime.package.json"
    if runtime_pkg.exists():
        upstream = VENDOR / "package.upstream.json"
        if not upstream.exists():
            shutil.copy2(package_json, upstream)
        shutil.copy2(runtime_pkg, package_json)
        print("  使用最小依赖清单（dpsend-runtime.package.json）")
    node_modules = VENDOR / "node_modules"
    if node_modules.exists() and (VENDOR / "node_modules" / "vite-node").exists():
        print("  ✓ 依赖已安装")
        return
    print("  安装依赖 (npm install)...")
    subprocess.run(["npm", "install", "--no-audit", "--no-fund"],
                   cwd=str(VENDOR), capture_output=True, timeout=900)
    # 确保 vite-node 可用
    if not (node_modules / "vite-node" / "dist" / "cli.mjs").exists():
        subprocess.run(["npm", "install", "-D", "vite-node", "--no-audit", "--no-fund"],
                       cwd=str(VENDOR), capture_output=True, timeout=300)


def main():
    check_only = "--check" in sys.argv
    local = get_local_version()
    remote = get_remote_version()

    print(f"本地版本: {local[:8] if local else '未知'}")
    print(f"上游版本: {remote[:8] if remote else '查询失败'}")

    if remote is None:
        sys.exit(1)

    if local == remote:
        print("✓ 已是最新")
        if check_only:
            return
        print("执行回归检查...")
        run_regression_check()
        return

    if check_only:
        print(f"⚠ 有更新可用: {local[:8] if local else '无'} → {remote[:8]}")
        print("  运行 python sync_endaxis.py 执行同步")
        return

    print(f"\n同步 {local[:8] if local else '无'} → {remote[:8]}...")

    # 备份
    backup_dir = ROOT / "vendor" / "endaxis_backup"
    if backup_dir.exists():
        shutil.rmtree(backup_dir)
    print("备份当前版本...")
    shutil.copytree(VENDOR, backup_dir,
                    ignore=shutil.ignore_patterns("node_modules"))

    try:
        download_and_extract(remote)
        npm_install()
        print("应用补丁...")
        apply_patches()
        print("回归检查...")
        if run_regression_check():
            print(f"\n✓ 同步完成，当前版本 {remote[:8]}")
            if backup_dir.exists():
                shutil.rmtree(backup_dir)
        else:
            print("\n✗ 回归测试失败，已回滚到旧版本")
            # 回滚
            src_dir = VENDOR / "src"
            if src_dir.exists():
                shutil.rmtree(src_dir)
            backup_src = backup_dir / "src"
            if backup_src.exists():
                shutil.copytree(backup_src, src_dir)
            # 恢复自定义文件
            for f in CUSTOM_FILES:
                src = backup_dir / f
                if src.exists():
                    shutil.copy2(src, VENDOR / f)
            print("  已恢复旧版，可手动检查上游变更")
    except Exception as e:
        print(f"\n✗ 同步失败: {e}")
        if backup_dir.exists():
            print("  可从 vendor/endaxis_backup 手动恢复")


if __name__ == "__main__":
    main()
