# 游戏文本导出脚本

本文档说明如何使用 `export_game_locales.py` 从 AKEDB CDN 导出 Endaxis 使用的游戏内容文本。脚本用于更新干员名称、技能说明、天赋说明、潜能说明、武器技能说明、装备套组效果说明和战斗术语富文本。

## 快速使用

在 Endaxis 仓库根目录执行：

```bash
python3 scripts/export_game_locales/export_game_locales.py
```

默认输出到：

```text
src/i18n/game-locales/zh/operators.json
src/i18n/game-locales/zh/terms.json
src/i18n/game-locales/zh/weapons.json
src/i18n/game-locales/zh/gearsets.json
src/i18n/game-locales/en/operators.json
src/i18n/game-locales/en/terms.json
src/i18n/game-locales/en/weapons.json
src/i18n/game-locales/en/gearsets.json
```

常用参数：

```bash
# 强制重新拉取 CDN 文件，覆盖本地缓存
python3 scripts/export_game_locales/export_game_locales.py --refresh-cache

# 导出到临时目录，便于 diff 后再决定是否覆盖正式数据
python3 scripts/export_game_locales/export_game_locales.py --output /tmp/endaxis-game-locales

# 指定 AKEDB manifest 版本；默认 latest
python3 scripts/export_game_locales/export_game_locales.py --version latest
```

完整参数可查看：

```bash
python3 scripts/export_game_locales/export_game_locales.py --help
```

## 数据来源

脚本默认读取：

```text
https://data.akedata.wiki/manifest.json
```

再根据 manifest 中的 `latest` 或 `--version` 指定版本定位 `tableCfgPath`，并从 CDN 下载所需表文件。

当前用到的 AKEDB 表：

| 文件                                              | 用途                                        |
| ------------------------------------------------- | ------------------------------------------- |
| `I18nTextTable_CN.json` / `I18nTextTable_EN.json` | 中英文文本表                                |
| `CharacterTable.json`                             | 干员基础入口、名称                          |
| `CharGrowthTable.json`                            | 技能组、技能说明、天赋节点                  |
| `CharacterPotentialTable.json`                    | 潜能名称和潜能效果入口                      |
| `PotentialTalentEffectTable.json`                 | 天赋/潜能效果说明和 blackboard              |
| `SkillPatchTable.json`                            | 技能说明、技能 blackboard 和补丁 blackboard |
| `HyperlinkTextTable.json`                         | `<#ba.*>` 战斗术语名称、说明、样式和图标    |
| `WeaponBasicTable.json`                           | 武器名称入口、武器技能列表                  |
| `ItemTable.json`                                  | 武器道具名称                                |
| `EquipSuitTable.json`                             | 装备套组名称、套组技能入口                  |

下载缓存位于：

```text
~/.cache/endaxis-export-game-locales
```

默认使用缓存；需要刷新时使用 `--refresh-cache`。临时禁用缓存可使用 `--no-cache`。

## 输出结构

`operators.json` 的主要结构：

```json
{
  "arcane": {
    "name": "诀",
    "forms": {
      "int": "阵诀·智",
      "will": "阵诀·意"
    },
    "talents": [],
    "potentials": [],
    "combatSkills": {
      "battleSkill": {
        "name": "摧玉网格",
        "description": "...",
        "forms": {
          "int": {
            "description": "..."
          }
        }
      }
    }
  }
}
```

`terms.json` 的主要结构：

```json
{
  "ba.burning": {
    "name": "法术异常 - 燃烧",
    "description": "...",
    "styleId": "ba.fire",
    "iconPath": "/icons/icon_term_ba_burning.webp"
  }
}
```

`weapons.json` 的主要结构：

```json
{
  "lone-barge": {
    "name": "“碾骨之拳”罗丹",
    "skill1": {
      "name": "意志",
      "description": "意志<@ba.vup>+{0}</>",
      "values": [20, 23, 26, 29, 32, 35, 38, 41, 45]
    },
    "skill3": {
      "name": "压制·流霆",
      "description": "电磁伤害<@ba.vup>+{0}%</>。\n...",
      "values": [
        [16, 20, 40],
        [18.5, 22.5, 45]
      ]
    }
  }
}
```

武器技能说明来自 `WeaponBasicTable.weaponSkillList[]` 指向的 `SkillPatchTable`。AKEDB 每个技能等级通常使用同一段说明模板，只是 blackboard 数值不同；导出时不会输出多段重复说明，而是：

- 校验所有等级的说明模板一致；如果模板变化，直接报错。
- 将 `{atk_up:0.0%}` 这类 AKEDB 命名占位符改写为 `{0}` / `{1}` 这类索引占位符。
- 如果某个占位符在所有等级都是同一个值，就直接内联到 `description`。
- 如果占位符随等级变化，就把各等级数值写入 `values`。单占位符使用一维数组，多占位符使用二维数组。
- 百分号保留在 `description` 里，`values` 中只保存数字，便于运行时按当前技能等级替换。

武器 ID 和 Endaxis 内部 slug 不完全一致。脚本会读取 `src/data/weapons/**/*.ts` 中的本地武器图标 ID，再通过 AKEDB `ItemTable.iconId` 反查真实武器 ID 来建立映射；这个步骤只用于识别对应关系，不会导出或复制武器图标。不能直接把图标 ID 当作武器 ID，因为少数武器的 `iconId` 与武器 ID 不一致，例如爆破单元和骑士精神。

`gearsets.json` 的主要结构：

```json
{
  "hot-work": {
    "setName": "动火用",
    "description": "3件套组效果：装备者源石技艺强度<@ba.vup>+30</>。\n..."
  }
}
```

装备套组效果来自 `EquipSuitTable.list[].skillID` 指向的 `SkillPatchTable`。当前游戏规则是穿戴同套装 3 件及以上触发套组效果，因此导出文件不再保存 `requiredCount` 或 `bonuses` 包装层；脚本会校验 AKEDB 中每个套装只有一个 `equipCnt == 3` 的效果。脚本会按 `skillLv` 选择对应 `SkillPatchDataBundle`，用该 bundle 的 `blackboard` 替换描述中的 `{变量:格式}` 占位符，并保留富文本标签供前端渲染。

AKEDB 的套组 ID（例如 `suit_fire_natr01`）和 Endaxis 内部 slug（例如 `hot-work`）不是同一种命名。脚本默认从现有 `src/data/gearpieces/**/*.ts` 中读取装备图标路径和 `setSlug` 推导映射；新增套装如果还没有进入 Endaxis 装备数据，会临时回退为由 AKEDB suit ID 生成的 slug。

## 保留旧文件字段

导出时会读取正式输出目录中已有的 `operators.json`：

- 保留旧文件的干员顺序，减少无意义 diff。
- 保留旧文件中的 `subSkills`，因为当前脚本尚未从 AKEDB 生成子技能名称。
- 保留旧文件中的 `forms` 作为兜底；如果 AKEDB 本次导出了新的 form 标签，以新导出内容为准。

注意：即便使用 `--output /tmp/...` 指定临时目录，旧文件也始终从仓库默认目录 `src/i18n/game-locales` 读取。这可以保证临时导出和正式导出使用同一份排序及手工字段基线。

导出 `gearsets.json` 时也会读取旧文件：

- 保留旧文件的套装顺序，减少无意义 diff。
- 保留 `no-set-bonuses` 这类并非 AKEDB 套组的本地占位项。

导出 `weapons.json` 时也会读取旧文件：

- 保留旧文件的武器顺序和现有手工字段，例如 `prefix`、`isPercent` 等。
- 保留旧文件中已有的技能名称；如果旧文件缺少技能名称，则使用 AKEDB 导出的名称补齐。
- 更新技能 `description` 和用于占位符替换的 `values`。

## 富文本规则

脚本保留并规范化三类富文本标签：

| 标签               | 示例                                             | 输出行为                                                                   |
| ------------------ | ------------------------------------------------ | -------------------------------------------------------------------------- |
| `<@styleId>...</>` | `<@ba.fire>灼热伤害</>`                          | 保留样式标签，运行时由 `src/data/gameRichText.ts` 上色并可显示样式前置图标 |
| `<#termId>...</>`  | `<#ba.burning>燃烧</>`                           | 保留术语标签，运行时可显示术语 tooltip                                     |
| `<image="path">`   | `<image="bufficon/icon_energy_fusion_fire.png">` | 转换为 Endaxis 内部 `/icons/*.webp` 路径                                   |

图标映射集中维护在：

```text
scripts/export_game_locales/export_game_locales.py
```

也就是脚本内的 `ENDAXIS_ICON_PATH_MAP`。如果 AKEDB 新增图片路径，必须先补映射或添加对应资源；脚本不会静默丢弃未知图片。

## 双形态技能说明

诀（Arcane）这类双形态干员的数据来自 AKEDB 技能组里的 `conditionDesc*` 字段。脚本会：

- 读取 `conditionId`，映射到 Endaxis 内部 form key。
- 读取 `conditionName`，汇总到干员级 `forms` 作为形态显示名。
- 将通用技能说明和对应形态的 `conditionPostDesc` 合并为该形态说明。
- 校验但不导出 `conditionDesc` / `conditionDescInactive` 中的“生效/未生效”句子；UI 层负责根据当前实际形态显示 `生效中` 标记。

当前 form key 映射：

| AKEDB suffix | Endaxis form key |
| ------------ | ---------------- |
| `str`        | `strength`       |
| `agi`        | `agility`        |
| `wisd`       | `int`            |
| `will`       | `will`           |

## 严格校验策略

导出脚本的原则是“遇到未知结构直接失败”，避免生成语义缺失但看似正常的 JSON。

会导致导出失败的情况包括：

- 出现未支持的富文本标签。
- `<@...>` / `<#...>` 标签未正确闭合。
- `<image>` 使用未映射图片路径或未知属性。
- 文本引用存在但无法从 `I18nTextTable` 解析。
- blackboard 容器不是列表。
- blackboard 项出现未知字段。
- blackboard 数值不是数字，或字符串字段非空。
- `skillBbModifier` / `attrModifier` / `skillParamModifier` 出现未建模字段类型。
- 占位符变量不存在。
- 占位符表达式不是数字、变量、括号或四则运算。
- 占位符 format 不是已支持格式。

## 更新后检查

推荐流程：

```bash
python3 scripts/export_game_locales/export_game_locales.py --refresh-cache
npm run test -- src/data/gameText.test.ts src/data/gameRichText.test.ts
npm run build
```

如果导出的 JSON diff 很大，先确认 manifest 版本、AKEDB 热更版本和新增干员/术语是否符合预期，再提交。
