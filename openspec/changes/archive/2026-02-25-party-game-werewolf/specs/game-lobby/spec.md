## ADDED Requirements

### Requirement: 展示游戏列表
游戏大厅 SHALL 展示所有可玩游戏的卡片列表，每张卡片包含游戏名称、简介和封面图。

#### Scenario: 进入大厅看到游戏列表
- **WHEN** 用户从首页进入游戏大厅
- **THEN** 页面显示至少一张游戏卡片（狼人真言）

#### Scenario: 点击游戏卡片进入游戏
- **WHEN** 用户点击某个游戏卡片
- **THEN** 跳转到对应游戏页面（狼人真言 → `/pages/werewolf/index`）
