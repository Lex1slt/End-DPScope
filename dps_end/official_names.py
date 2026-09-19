"""官方名称同步：从 AKEData 拉取装备/武器的官方中文名。

Endaxis 自带的 zh 语言表名字基本与官方一致，但它是随上游仓库更新的；
这里直接对 AKEData 的 EquipTable/ItemTable/I18nTextTable_CN 按游戏物品ID取官方名，
作为覆盖层写进 .akedata_cache/official_names.json，由 /api/catalog 叠加输出。

映射链：Endaxis sheet 的 icon 文件名 = 游戏物品ID（如 item_equip_t4_suit_combo_cd01_edc_04）
→ EquipTable[gameId].itemId → ItemTable[itemId].name.id → I18nTextTable_CN → 官方中文名。
武器只有一部分（较新的）在 ItemTable 里；没查到的保留 Endaxis 名（已用语料校验）。
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from .akedata import _fetch, _table_url

CACHE_FILE = "official_names.json"
MAX_AGE_DAYS = 30.0


def _cache_path(cache_dir: Path) -> Path:
    return cache_dir / CACHE_FILE


def load(cache_dir: str | Path) -> dict:
    """读已同步的官方名；没有就返回空表。"""
    p = _cache_path(Path(cache_dir))
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _get_table(table: str, cache_dir: Path, max_age_days: float):
    path = cache_dir / f"AKE_{table}.json"
    if path.exists() and time.time() - path.stat().st_mtime < max_age_days * 86400:
        return json.loads(path.read_text(encoding="utf-8"))
    data = json.loads(_fetch(_table_url(table)))
    cache_dir.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def refresh(cache_dir: str | Path, catalog: dict, max_age_days: float = 30.0) -> dict:
    """按 catalog 里的 gameId 到 AKEData 取官方中文名，返回并落盘覆盖层。"""
    cache_dir = Path(cache_dir)
    equips = _get_table("EquipTable", cache_dir, max_age_days)
    items = _get_table("ItemTable", cache_dir, max_age_days)
    i18n = _get_table("I18nTextTable_CN", cache_dir, max_age_days)

    def cn_of(entry: dict) -> str:
        name = entry.get("name") or {}
        v = i18n.get(str(name.get("id")))
        if isinstance(v, str):
            return v
        if isinstance(v, dict):
            return v.get("cn", "")
        return ""

    def official(game_id: str | None) -> str:
        if not game_id:
            return ""
        equip = equips.get(game_id)
        if equip is not None:
            # 装备链：EquipTable[gameId].itemId → ItemTable[itemId].name.id → 官方名
            return cn_of(items.get(equip.get("itemId") or ""))
        entry = items.get(game_id) or items.get(f"item_{game_id}")
        return cn_of(entry) if entry else ""

    out: dict = {"gear": {}, "weapons": {}, "syncedAt": time.strftime("%Y-%m-%d %H:%M")}
    for g in catalog.get("gearpieces", []):
        name = official(g.get("gameId"))
        if name:
            out["gear"][g["slug"]] = name
    for w in catalog.get("weapons", []):
        name = official(w.get("gameId"))
        if name:
            out["weapons"][w["slug"]] = name

    cache_dir.mkdir(parents=True, exist_ok=True)
    _cache_path(cache_dir).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def apply(catalog: dict, official: dict) -> dict:
    """把官方名覆盖到目录上（缺省保留 Endaxis 名）。返回新目录，不改原对象。"""
    if not official:
        return catalog
    gear = []
    for g in catalog.get("gearpieces", []):
        name = official.get("gear", {}).get(g["slug"])
        gear.append({**g, "name": name} if name else g)
    weapons = []
    for w in catalog.get("weapons", []):
        name = official.get("weapons", {}).get(w["slug"])
        weapons.append({**w, "name": name} if name else w)
    return {**catalog, "gearpieces": gear, "weapons": weapons}


def refresh_if_stale(cache_dir: str | Path, catalog: dict, max_age_days: float = 30.0) -> dict | None:
    """缓存新鲜就返回现有覆盖层，否则联网刷新；离线/失败静默返回 None。"""
    try:
        return load(cache_dir)
    except Exception:
        return None
