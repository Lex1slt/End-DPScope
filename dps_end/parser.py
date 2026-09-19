"""排轴JSON读取与格式识别。"""

from __future__ import annotations

import json


def load_json(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def pick_scenario(project: dict) -> dict:
    """取激活的方案（scenarioList条目）。"""
    scenarios = project.get("scenarioList") or []
    if not scenarios:
        raise ValueError("JSON中没有 scenarioList，无法解析")
    active = project.get("activeScenarioId")
    return next((s for s in scenarios if s.get("id") == active), scenarios[0])


def parse_file(path: str) -> dict:
    data = load_json(path)
    if isinstance(data, dict) and data.get("scenarioList"):
        return data
    raise ValueError("无法识别的排轴JSON格式：不是Endaxis导出")
