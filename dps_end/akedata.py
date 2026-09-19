"""AKEData (akedata.wiki) 数据接入：名称解析与敌人属性预设。

AKEData 的数据后端为 data.akedata.wiki（游戏 TableCfg 镜像），
本模块提供两类能力：
1. refresh_names():  拉取 CharacterTable / EnemyTemplateDisplayInfoTable / I18nTextTable_CN，
                     生成 slug->中文名 的映射并写入 names.json；
2. fetch_enemy():    按敌人模板ID与等级读取敌人属性（HP/防御/抗性/失衡/处决系数）。

网络不可用时自动回退到随包的 names.json / 已缓存表格。
"""

from __future__ import annotations

import json
import os
import re
import urllib.request
from pathlib import Path

BASE = "https://data.akedata.wiki"
VERSION_PATH = "/manifest.json"
import sys as _sys
if getattr(_sys, '_MEIPASS', None):
    PKG_NAMES = os.path.join(os.path.dirname(os.path.abspath(_sys.executable)),
                             "dps_end", "data", "names.json")
    CACHE_DIR = Path(os.path.dirname(os.path.abspath(_sys.executable))) / ".akedata_cache"
else:
    PKG_NAMES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                             "dps_end", "data", "names.json")
    CACHE_DIR = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / ".akedata_cache"

_TABLE_FILES = {
    "I18nTextTable_CN": "AKE_I18nTextTable_CN.json",
    "CharacterTable": "AKE_CharacterTable.json",
    "EnemyTemplateDisplayInfoTable": "AKE_EnemyTemplateDisplayInfoTable.json",
    "EnemyAttributeTemplateTable": "AKE_EnemyAttributeTemplateTable.json",
}


def slugify(s: str) -> str:
    s = s.replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


ALLOWED_FETCH_HOSTS = ("data.akedata.wiki",)

def _guard_url(url: str) -> None:
    """仅允许白名单域名的 HTTPS 请求，并阻断解析到私网/环回的地址（防 DNS rebinding）。"""
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


def _fetch(url: str, timeout: int = 60) -> bytes:
    _guard_url(url)
    req = urllib.request.Request(url, headers={"User-Agent": "dps-end/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _safe_cache_path(cache_dir: str | os.PathLike, name: str) -> str:
    """缓存文件路径：解析后必须仍位于缓存目录内，拒绝路径穿越。"""
    base = Path(cache_dir).resolve()
    p = (base / name).resolve()
    if p != base and base not in p.parents:
        raise ValueError(f"缓存路径越界: {name}")
    return str(p)


def _table_url(table: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_]+", table):
        raise ValueError(f"非法表名: {table}")
    m = json.loads(_fetch(BASE + VERSION_PATH, 30))
    cfg = m["versions"][0]["tableCfgPath"]
    return f"{BASE}/{cfg}/{table}.json"


def load_names() -> dict:
    try:
        with open(PKG_NAMES, encoding="utf-8") as f:
            return json.load(f)
    except OSError:
        return {"operators": {}, "weapons": {}, "enemies": {}}


def refresh_names(cache_dir: str | None = None, out_path: str | None = None) -> dict:
    """从 AKEData 数据后端重建名称映射。"""
    def get(table: str):
        if table not in _TABLE_FILES:
            raise ValueError(f"未知数据表: {table}")
        path = CACHE_DIR / _TABLE_FILES[table]
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        data = json.loads(_fetch(_table_url(table)))
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path.write_bytes(json.dumps(data, ensure_ascii=False).encode("utf-8"))
        return data

    i18n = get("I18nTextTable_CN")
    chars = get("CharacterTable")
    disp = get("EnemyTemplateDisplayInfoTable")

    def cn(text_id) -> str:
        if text_id is None:
            return ""
        v = i18n.get(str(text_id))
        return v if isinstance(v, str) else (v or {}).get("cn", "") if isinstance(v, dict) else ""

    operators = {}
    for cid, c in chars.items():
        eng = (c.get("engName") or "").strip()
        name = c.get("name") or {}
        cn_name = name.get("text") or cn(name.get("id"))
        if eng and cn_name:
            operators[slugify(eng)] = cn_name
    enemies = {}
    for eid, d in disp.items():
        name = d.get("name") or {}
        cn_name = name.get("text") or cn(name.get("id"))
        if cn_name:
            enemies[eid] = cn_name
    out = {"operators": operators, "enemies": enemies, "weapons": {}}
    path = out_path or PKG_NAMES
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Path(path).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def fetch_enemy(enemy_id: str, level: int = 90, cache_dir: str | None = None) -> dict:
    """读取敌人模板属性，返回与 EnemyConfig 字段对应的 dict。"""
    path = CACHE_DIR / "AKE_EnemyAttributeTemplateTable.json"
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            table = json.load(f)
    else:
        table = json.loads(_fetch(_table_url("EnemyAttributeTemplateTable")))
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path.write_bytes(json.dumps(table, ensure_ascii=False).encode("utf-8"))
    tpl = table.get(enemy_id)
    if not tpl:
        raise KeyError(f"敌人模板不存在: {enemy_id}")

    def attr_at(level_: int, attr_type: int) -> float:
        for d in tpl.get("levelDependentAttributes") or []:
            attrs = d.get("attrs") or []
            if attrs and int(attrs[0].get("attrValue", 0)) == level_:
                for a in attrs:
                    if a.get("attrType") == attr_type:
                        return float(a.get("attrValue", 0))
        return 0.0

    indep = {a.get("attrType"): a.get("attrValue")
             for a in (tpl.get("levelIndependentAttributes") or {}).get("attrs") or []}
    return {
        "enemy_id": enemy_id,
        "name": enemy_id,
        "level": level,
        "hp": attr_at(level, 1) or 1e9,
        "atk": attr_at(level, 2),
        "defense": attr_at(level, 3) or 100.0,
        "resistance": {
            "physical": float(tpl.get("physicalResistance") or 0),
            "heat": float(tpl.get("fireResistance") or 0),
            "cryo": float(tpl.get("crystResistance") or 0),
            "electric": float(tpl.get("pulseResistance") or 0),
            "nature": float(tpl.get("naturalResistance") or 0),
            "ether": 0,
        },
        "max_stagger": float(indep.get(20)) if indep.get(20) is not None else None,
        "execution_taken_scalar": float(indep.get(27)) if indep.get(27) is not None else 1.5,
    }


def refresh_enemy_table(cache_dir: str | None = None, max_age_days: float = 7.0) -> bool:
    """刷新敌人属性模板表缓存；超过 max_age_days 才联网，失败返回 False。

    供启动时的自动数据同步调用，保证「敌人模板」预设读到较新的解包数值。
    """
    import time

    path = CACHE_DIR / "AKE_EnemyAttributeTemplateTable.json"
    try:
        age = time.time() - path.stat().st_mtime if path.exists() else float("inf")
        if age < max_age_days * 86400:
            return False
        table = json.loads(_fetch(_table_url("EnemyAttributeTemplateTable")))
        cache_dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(json.dumps(table, ensure_ascii=False).encode("utf-8"))
        return True
    except Exception:
        return False
