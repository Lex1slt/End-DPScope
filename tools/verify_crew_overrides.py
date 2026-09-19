"""端到端校验：前端 队伍配置 的 overrides 载荷真的会改变乘区结果。

复刻 App.tsx 的 crewOverrides() 载荷形状（含 weapon.slug 与 gears.pieceId），
对比「原样」「换武器」「换装备」三种情况下的总伤害。
"""
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Endaxis_Timeline_2026-09-13.json"
API = "http://127.0.0.1:8686/api/calculate"


def post(project, name, settings):
    """仅访问本机回环上的本地计算服务，无任何外网请求。"""
    import http.client

    body = json.dumps({"fileName": name, "project": project, "settings": settings},
                      ensure_ascii=False)
    conn = http.client.HTTPConnection("127.0.0.1", 8686, timeout=600)
    try:
        conn.request("POST", "/api/calculate", body=body,
                     headers={"Content-Type": "application/json"})
        resp = conn.getresponse()
        data = json.load(resp)
    finally:
        conn.close()
    if resp.status != 200:
        raise RuntimeError(f"本地服务返回 {resp.status}: {data.get('error')}")
    return data


def base_settings():
    return {
        "enemyMode": "timeline",
        "custom": {"hp": "100000000", "def": "100", "stagger": "320", "breakDur": "9",
                   "execSp": "50", "res": {k: "20" for k in
                                           ("physical", "heat", "cryo", "electric", "nature")}},
        "template": {"id": "", "level": "90", "hpmult": "1.0"},
        "crit": "", "cdmg": "", "operators": [],
    }


def crew_payload(project, mutate=None):
    """按 App.tsx parseCrew + crewOverrides 的形状构造载荷。"""
    sc = project["scenarioList"][0]
    data = sc["data"]
    ops = {o["id"]: o for o in data.get("operators", [])}
    wps = {w["id"]: w for w in data.get("weapons", [])}
    ges = {g["id"]: g for g in data.get("gears", [])}
    slots = {"armor": "equipArmorInstanceId", "gloves": "equipGlovesInstanceId",
             "kit1": "equipAccessory1InstanceId", "kit2": "equipAccessory2InstanceId"}
    out = []
    for tr in data.get("tracks", []):
        op = ops.get(tr.get("operatorInstanceId"))
        if not op:
            continue
        wp = wps.get(tr.get("weaponInstanceId"))
        gears = {}
        for slot, key in slots.items():
            g = ges.get(tr.get(key))
            pid = (g or {}).get("gearPieceId")
            gears[slot] = {"pieceId": pid if pid and pid != "—" else None,
                           "levels": list((g or {}).get("artificingLevels") or [])}
        row = {
            "track": tr["id"],
            "level": op.get("level", 90),
            "promoted": bool(op.get("promoted")),
            "potential": op.get("potential", 0),
            "trustLevel": op.get("trustLevel", 0),
            "talents": {k: v for k, v in (op.get("talentStates") or {}).items()},
            "skillLevels": dict(op.get("skillLevels") or {}),
            "weapon": {"slug": (wp or {}).get("weaponSlug"), "level": (wp or {}).get("level", 1),
                       "tuned": bool((wp or {}).get("tuned")),
                       "potential": (wp or {}).get("potential", 0),
                       "skill1Level": (wp or {}).get("skill1Level", 0),
                       "skill2Level": (wp or {}).get("skill2Level", 0),
                       "skill3Level": (wp or {}).get("skill3Level", 0)},
            "gears": gears,
        }
        if mutate:
            mutate(row, op.get("operatorSlug"), (wp or {}).get("weaponSlug"))
        out.append(row)
    return out


def total(project, overrides, label):
    s = base_settings()
    s["operators"] = overrides
    res = post(project, SRC.name, s)
    s_ = res["summary"]
    print(f"{label:<28} 总伤害 {s_['totalDamage']:>12,.0f}   DPS {s_['dps']:>9,.1f}")
    return s_["totalDamage"]


def main():
    project = json.loads(SRC.read_text(encoding="utf-8"))
    baseline = total(project, crew_payload(project), "原样（不改配置）")

    def swap_armor(row, slug, _w):
        if slug == "arcane":
            row["gears"]["armor"]["pieceId"] = "type-50-yinglung-light-armor"

    def swap_weapon(row, slug, _w):
        if slug == "last-rite":
            row["weapon"]["slug"] = "peco-5"

    def lower_skill(row, slug, _w):
        if slug == "last-rite":
            row["skillLevels"]["basicAttack"] = 1

    for fn, label in ((swap_armor, "诀：护甲→50式应龙轻甲"),
                      (swap_weapon, "别礼：武器→peco-5"),
                      (lower_skill, "别礼：普攻等级 12→1")):
        v = total(project, crew_payload(project, fn), label)
        delta = (v - baseline) / baseline * 100
        print(f"{'':<28} 相对原样 {delta:+.2f}%")


if __name__ == "__main__":
    main()
