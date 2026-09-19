# End-DPScope · 终末地排轴伤害计算

导入《明日方舟：终末地》排轴方案（Endaxis 导出的时间轴 JSON），生成 Excel 伤害报告：
每一段 hit 的实际伤害、整段排轴总伤害、DPS、DPSP，
以及每个干员的伤害占比、拐力占比、实际贡献占比。

**计算核心为 [Endaxis](https://github.com/Lieyuan621/Endaxis) 开源模拟器**（已内置于 `vendor/endaxis`），
伤害乘区、状态/触发器语义、法术异常反应（腐蚀/法术爆发/导电/燃烧/冻结/碎冰）、
失衡与处决、SP与终结技能量经济、LMDI 干员归因均与 Endaxis 网页版一致
（对同一排轴验证：总伤害/循环时间完全对齐，误差 <0.2%，来自版本库差异）。

## 快速开始

```bash
pip install -r requirements.txt          # openpyxl
cd vendor/endaxis && npm install && cd ..   # 首次使用需安装模拟器依赖（Node.js 20+）

# 方式一：直接编写原生配置（不依赖Endaxis导出）
python -m dps_end report examples/样例配置.json

# 方式二：导入Endaxis排轴JSON
python -m dps_end report Endaxis_Timeline_2026-09-13.json
```

### 敌人配置

```bash
# 默认：0抗性、极大血量(10亿)训练木桩，不启用失衡
python -m dps_end report 排轴.json

# 使用排轴文件内置的敌人配置（如 天鼓 396万血/50全抗）
python -m dps_end report 排轴.json --enemy timeline

# 使用 AKEData 敌人模板（按模板ID读取属性，可击杀判定）
python -m dps_end report 排轴.json --enemy eny_0082_hsbear

# 手动覆盖敌人参数
python -m dps_end report 排轴.json --enemy-hp 2e9 --enemy-def 100 --enemy-res "cryo=0,heat=20"
python -m dps_end report 排轴.json --stagger-cap 320          # 启用失衡（失衡期易伤×1.3）
```

### 面板校准（对齐实战）

```bash
# Endaxis 装备系统不含暴击副词条，如实战面板有暴击/暴伤，
# 请按游戏内面板实际值覆盖（百分点，基础为5%/50%）：
python -m dps_end report 排轴.json   --crit-rate "last-rite=62.5,tangtang=55,arcane=40,xaihi=30"   --crit-dmg "last-rite=150,tangtang=120,arcane=100,xaihi=80"
```

## 原生配置格式

不依赖Endaxis，直接编写配置文件（JSON）即可：

```json
{
  "__native": {
    "name": "我的轴",
    "durationSec": 120,
    "prepSec": 5,
    "enemy": {
      "id": "eny_0082_hsbear",
      "level": 90,
      "hpMultiplier": 3.6,
      "resistance": { "physical": 50, "heat": 50, "cryo": 50, "electric": 50, "nature": 50 }
    },
    "operators": [
      {
        "operator": "last-rite",
        "level": 90, "promoted": true, "potential": 0, "trust": 4,
        "skills": { "basicAttack": 12, "battleSkill": 12, "comboSkill": 12, "ultimate": 12 },
        "talents": { "0": 2, "1": 2 },
        "weapon": { "slug": "khravengger", "level": 90, "tuned": true,
                    "affix1": 9, "affix2": 9, "talent": 4 },
        "gears": [
          "tide-fall-light-armor@3,3,3,3",
          "tide-surge-gauntlets@3,3,3,3",
          "hanging-river-o2-tube@3,3,3,3",
          "lynx-slab@3,3,3,3"
        ],
        "rotation": [
          { "t": 5.02, "skill": "basicAttack", "segment": 1 },
          { "t": 5.72, "skill": "basicAttack", "segment": 2 },
          { "t": 6.77, "skill": "basicAttack", "segment": 3 },
          { "t": 7.83, "skill": "basicAttack", "segment": 4 },
          { "t": 17.47, "skill": "battleSkill" },
          { "t": 21.85, "skill": "comboSkill" },
          { "t": 52.45, "skill": "ultimate" }
        ],
        "critRate": 62.5,
        "critDmg": 150
      }
    ]
  }
}
```

- `enemy.id` 可选，缺省为自定义木桩（0抗性/10亿血）。`hpMultiplier` 用于战争回响等高血量模式。
- `gears` 数组按顺序填写 护甲/护手/配件1/配件2，`@` 后接精锻等级。
- `rotation[].t` 单位秒；`skill` ∈ basicAttack（可加 `segment: 1-4` 指定段位）/ battleSkill / comboSkill / ultimate / finisher / dive。
- `critRate` / `critDmg` 可选，填实战面板实际值以对齐游戏。
- 完整样例见 `examples/样例配置.json`。

## 输出报表（5个工作表）

| 工作表 | 内容 |
| --- | --- |
| **计算过程**（主表） | 顶部为总结性数据（方案/敌人/总伤害/DPS/DPSP/干员贡献）；下方按时间顺序每行一段伤害：时间、干员、动作、段位/说明、有效攻击力**及其来源**、倍率、基础伤害、**实际伤害(非暴击)/暴击伤害**（可与游戏实战逐hit对照）、期望伤害，以及各大乘区数值**与乘区来源明细**（加成区/增幅区/脆弱区/易伤区逐项列出每条增益及其数值，抗性区列出基础抗性−腐蚀削减，失衡/处决/连击/反应系数等），最右为LMDI拐力归因 |
| 总览 | 敌人信息、总伤害（期望/不暴击/全暴击）、DPS、DPSP、干员贡献表（结算伤害/伤害占比/拐力/拐力占比/实际贡献/实际贡献占比/SP消耗/终结技次数） |
| 技能与元素分布 | 按技能类型、按元素、干员×技能类型 |
| SP与能量 | 技力（全队共享）与终结技能量逐事件流水 |
| 增益覆盖统计 | 每个增益/减益的生效命中数与受益干员 |

**口径说明**
- **DPS = 总伤害 ÷ (最后一次造成伤害的时间 − 统计起点)**，与 Endaxis「循环时间」口径一致
  （对一份 60 秒左右的轴，即按约 60 秒计算，而不是按整段战斗窗口摊薄）。
- **结算伤害 / 拐力**：Endaxis 的 LMDI 归因——结算伤害为该干员命中剔除他人增益归因后的部分，
  拐力为其施加的增益/减益对**他人**伤害的归因贡献；实际贡献 = 结算伤害 + 拐力，全队合计 = 总伤害。
- **DPSP = 总伤害 ÷ 总SP（技力）消耗**。
- 期望伤害 = 非暴击伤害 × (1 + 暴击率 × 暴击伤害)，明细表同时给出非暴击与全暴击两列。

## 引擎能力（由 Endaxis 模拟器提供）

- 帧级离散事件模拟：动作/命中/状态/触发器/DoT/失衡/处决/SP与终结技能量
- 完整乘区：基础伤害、暴击、伤害加成（元素+技能类型+装备词条）、增幅、脆弱、易伤、连击、
  防御（MAX(防,100)）、抗性（含腐蚀削减与无视）、失衡易伤1.3、处决承伤系数
- 法术异常：寒冷/灼热/电磁/自然附着叠层、法术爆发、腐蚀（源石技艺强度强化、按秒削抗）、导电、燃烧、冻结
- 触发器：onActionStart / onHit / onFinalStrike / onFinisher / onDive / onStatusApplied /
  onStatusConsumed / onStatusExpire，作用域默认 self、显式 global 时 self=触发事件执行者
- 状态层数默认累加（受 maxStacks 上限），支持 INDEPENDENT 独立实例与 oneTime 效果
- 干员/武器/装备（套装+词条+精锻）/潜能/天赋/信赖 的面板与被动效果装配

## 项目结构

```
DPS END/
├── dps_end/            # Python 包
│   ├── cli.py          # 命令行入口
│   ├── simnode.py      # 调用 Endaxis 模拟器（Node）
│   ├── parser.py       # 排轴JSON读取
│   ├── report.py       # Excel 报表（openpyxl）
│   ├── akedata.py      # AKEData 数据接入（名称映射、敌人模板）
│   └── data/names.json # 中文名映射（refresh-names 可更新）
├── vendor/endaxis/     # Endaxis 模拟器源码 + dpsend-harness.ts 桥接
├── output/             # 生成的报告
```

`vendor/endaxis` 来自 [Lieyuan621/Endaxis](https://github.com/Lieyuan621/Endaxis)，
版权归原作者所有，本项目仅作本地计算使用并在报告中署名。
`vendor/endaxis/dpsend-harness.ts` 为本项目的桥接脚本：载入排轴项目、
复刻应用的装配管线（armory → collectEffects → 初始效果 → 触发器注册），
运行模拟并导出逐hit明细/LMDI归因/SP能量流水。
