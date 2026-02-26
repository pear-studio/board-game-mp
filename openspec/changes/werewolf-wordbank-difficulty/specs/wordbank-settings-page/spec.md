## ADDED Requirements

### Requirement: 词库设置独立入口
游戏设置页 SHALL 在"开始游戏"按钮上方展示"词库设置"按钮，点击后跳转至独立词库设置页面。

#### Scenario: 点击词库设置按钮
- **WHEN** 用户在游戏设置页点击"词库设置"按钮
- **THEN** 跳转至 `/pages/wordbank-settings/index` 页面

### Requirement: 词库分组展示与勾选
词库设置页 SHALL 将内置分类按难度（简单/中等/困难）分组展示，每组显示该难度下的所有分类卡片，可单独勾选/取消每个分类。

#### Scenario: 展示分组
- **WHEN** 用户进入词库设置页
- **THEN** 页面显示三个难度组，每组标题下列出对应分类，每个分类显示名称和词条数量

#### Scenario: 单独勾选分类
- **WHEN** 用户点击某个分类卡片
- **THEN** 该分类的勾选状态切换，页面立即更新，storage 同步写入

### Requirement: 按难度批量操作
词库设置页每个难度组 SHALL 提供"全选"/"全取消"按钮，一键操作该难度下所有分类。

#### Scenario: 全选某难度
- **WHEN** 用户点击"简单"分组的"全选"
- **THEN** `food`、`animal`、`place` 三个分类全部被勾选，storage 更新

#### Scenario: 全取消某难度
- **WHEN** 某难度下所有分类已选中，用户点击"全取消"
- **THEN** 该难度下所有分类取消勾选，storage 更新

#### Scenario: 至少保留一个分类
- **WHEN** 当前仅剩一个分类被选中，用户尝试取消它
- **THEN** 操作被阻止，提示"至少需要选择一个词库分类"

### Requirement: 选择结果持久化
用户的词库分类选择 SHALL 通过 `wx.setStorageSync` 持久化，key 为 `wordbank_selected_categories`，值为分类 id 字符串数组。

#### Scenario: 首次进入默认值
- **WHEN** storage 中无 `wordbank_selected_categories` 记录（首次使用）
- **THEN** 默认选中全部 easy + medium 分类（共7个），并写入 storage

#### Scenario: 重启后保持选择
- **WHEN** 用户关闭小程序后重新打开
- **THEN** 词库设置页读取 storage，恢复上次的勾选状态

### Requirement: 已订阅自定义词库展示
词库设置页 SHALL 在内置分组下方展示用户已订阅的自定义词库，可同样勾选/取消纳入游戏词池。

#### Scenario: 展示订阅词库
- **WHEN** 用户有已订阅的自定义词库
- **THEN** 页面底部"自定义词库"区域显示各订阅词库的名称、词条数量和分享码

#### Scenario: 无订阅时展示入口
- **WHEN** 用户无任何订阅词库
- **THEN** 显示"创建或订阅词库"引导入口，点击跳转至自定义词库管理页
