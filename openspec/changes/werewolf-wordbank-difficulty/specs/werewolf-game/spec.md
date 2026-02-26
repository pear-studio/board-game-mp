## MODIFIED Requirements

### Requirement: 游戏开始时按已选分类抽词
`startGame` SHALL 从 storage 读取 `wordbank_selected_categories`（含自定义词库 id），合并对应词条后调用 `getRandomWords` 抽取3个候选词供村长选择。若 storage 无记录则使用默认分类（easy + medium）。

#### Scenario: 按已选分类抽词
- **WHEN** storage 中 `wordbank_selected_categories` 为 `['food', 'animal']`，用户点击"开始游戏"
- **THEN** 3个候选词均来自食物或动物分类

#### Scenario: 包含自定义词库
- **WHEN** 已选分类包含一个自定义词库 id，且本地有该词库缓存词条
- **THEN** 自定义词库的词条加入抽词池，3个候选词可能来自该自定义词库

#### Scenario: 无已选分类时使用默认
- **WHEN** storage 中无 `wordbank_selected_categories` 记录
- **THEN** 使用 easy + medium 全部7个内置分类作为词池抽词
