"""更新检查：计算核心（Endaxis 上游）与应用本体（manifest，可选）。

- 计算核心更新：比对本地 vendor/endaxis/.dpsend_sync_version 与上游 GitHub 最新 commit，
  只提示不自动套用（套用需要开发者环境，由 sync_endaxis.py 完成）。
- 应用本体更新：读取 MANIFEST_URL 指向的 {version, url, notes}，正式发布安装包后配置；
  未配置时静默返回未启用，不影响任何功能。
"""

from __future__ import annotations

import json
import os
import re
import urllib.request
from pathlib import Path

ENGINE_REPO = "Lieyuan621/Endaxis"
ENGINE_REPO_URL = f"https://github.com/{ENGINE_REPO}"
MANIFEST_URL = ""  # TODO: 正式发布安装包后，把 manifest.json 的 URL 填在这里

# 可选：设置环境变量 GITHUB_TOKEN（公共仓库只读不需要任何 scope）后，
# GitHub API 限额从匿名 60 次/小时/IP 提升到 5000 次/小时。
_GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")


ALLOWED_FETCH_HOSTS = ("api.github.com", "github.com")


def _get_json(url: str, timeout: int = 8):
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_FETCH_HOSTS:
        raise ValueError(f"拒绝请求非白名单域名: {parsed.hostname}")
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "dps-end/1.0"}
    if _GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {_GITHUB_TOKEN}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def _latest_sha_via_atom(timeout: int = 15) -> str | None:
    """从 commits atom feed 取最新 sha；不占 api.github.com 的匿名限额。"""
    url = f"https://github.com/{ENGINE_REPO}/commits/main.atom"
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_FETCH_HOSTS:
        raise ValueError(f"拒绝请求非白名单域名: {parsed.hostname}")
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "dps-end/1.0"},
    )
    xml = urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "replace")
    m = re.search(r"/commit/([0-9a-f]{40})", xml)
    return m.group(1) if m else None


def engine_local_version(app_dir: Path) -> str | None:
    f = Path(app_dir) / "vendor" / "endaxis" / ".dpsend_sync_version"
    return f.read_text(encoding="utf-8").strip()[:8] if f.exists() else None


def check_engine(app_dir: Path, timeout: int = 8) -> dict:
    local = engine_local_version(app_dir)
    try:
        data = _get_json(f"https://api.github.com/repos/{ENGINE_REPO}/commits/main", timeout)
        remote = str(data.get("sha", ""))[:8]
        available = bool(remote) and (not local or remote != local)
        return {
            "local": local,
            "remote": remote,
            "updateAvailable": available,
            "repoUrl": ENGINE_REPO_URL,
            "via": "api",
        }
    except Exception:  # noqa: BLE001 — API 限额/离线时回退 atom feed
        try:
            sha = _latest_sha_via_atom(timeout)
        except Exception:  # noqa: BLE001
            sha = None
        if sha:
            remote = sha[:8]
            return {
                "local": local,
                "remote": remote,
                "updateAvailable": not local or remote != local,
                "repoUrl": ENGINE_REPO_URL,
                "via": "atom",
            }
        return {
            "local": local,
            "remote": None,
            "updateAvailable": False,
            "repoUrl": ENGINE_REPO_URL,
            "offline": True,
        }


def check_app(timeout: int = 8) -> dict:
    from . import __version__

    if not MANIFEST_URL:
        return {"configured": False, "version": __version__}
    try:
        data = _get_json(MANIFEST_URL, timeout)
        latest = str(data.get("version", ""))
        return {
            "configured": True,
            "version": __version__,
            "latest": latest,
            "updateAvailable": latest > __version__,
            "url": data.get("url"),
            "notes": data.get("notes", ""),
        }
    except Exception as exc:  # noqa: BLE001
        return {"configured": True, "version": __version__, "error": str(exc)[:120]}
