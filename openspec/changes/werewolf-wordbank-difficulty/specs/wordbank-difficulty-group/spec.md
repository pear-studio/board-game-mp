## ADDED Requirements

### Requirement: 内置词库按难度分组
内置词库 SHALL 包含10个分类，每类50词，按难度分为 easy（3类）、medium（4类）、hard（3类）。

分类列表：
- easy: `food`（食物）、`animal`（动物）、`place`（地点）
- medium: `daily-item`（日常物品）、`occupation`（职业）、`vehicle`（交通工具）、`sport-activity`（运动&活动）
- hard: `nature`（自然现象）、`abstract`（抽象概念）、`action`（动作行为）

#### Scenario: 词库数据结构正确
- **WHEN** 代码导入 `wordbank.js`
- **THEN** 导出的 `CATEGORIES` 为长度为10的数组，每项包含 `id`、`name`、`difficulty`、`words` 字段，`words` 长度为50

#### Scenario: 难度分布正确
- **WHEN** 筛选 `difficulty === 'easy'` 的分类
- **THEN** 返回3个分类：`food`、`animal`、`place`

### Requirement: 按分类过滤随机抽词
`getRandomWords(n, categoryIds)` SHALL 仅从传入的分类 id 列表对应的词条中随机抽取，不传 `categoryIds` 时从全部分类抽取。

#### Scenario: 按指定分类抽词
- **WHEN** 调用 `getRandomWords(3, ['food', 'animal'])`
- **THEN** 返回3个词，均来自 `food` 或 `animal` 分类

#### Scenario: 无参数时全库抽词
- **WHEN** 调用 `getRandomWords(3)`
- **THEN** 返回3个词，来自全部10个分类的词池
