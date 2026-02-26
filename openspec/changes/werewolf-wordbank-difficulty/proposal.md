## Why

当前词库是一个平铺的分类列表，玩家无法根据游戏氛围快速筛选词语难度，也无法自定义或与朋友共享词库。新玩家需要简单直白的词，老玩家想增加挑战或针对特定场景出题（如公司聚会、影视主题）时，只能依赖内置词库。引入难度分组、自定义词库及云端分享码，让玩家既能快速配置难度，也能创作并实时共享自己的词库。

## What Changes

- 词库数据结构新增 `difficulty` 字段，每个分类归属 `easy` / `medium` / `hard` 三档之一
- 游戏设置页新增"词库设置"独立入口按钮，位于"开始游戏"按钮上方，点击跳转独立的词库设置页面
- 词库设置页按难度分组展示，每个难度组支持"全选/全取消"批量操作
- 单个分类仍可独立勾选/取消，与批量操作保持一致
- 词库选择结果通过 `wx.setStorageSync` 持久化，跨游戏、跨页面、重置后均保持用户选择
- 默认选中难度：`easy` + `medium` 全部分类（首次启动时写入 storage，与现有行为向后兼容）
- 用户可在词库设置页创建自定义词库分类（命名 + 自由添加/删除词条）
- 创建完成后可生成**6位分享码**（如 `WF-A3K9`），其他用户输入分享码即可订阅该词库
- 订阅的自定义词库显示在词库设置页，与内置词库并列可勾选，创建者更新后订阅者自动同步最新版
- 自定义词库存储于微信云开发（CloudBase）数据库，本地 storage 仅缓存已订阅的词库 id 列表

## Capabilities

### New Capabilities
- `wordbank-difficulty-group`: 词库分类按难度（easy/medium/hard）分组，支持批量选中/取消某难度下所有分类，同时保留单个分类的独立勾选能力
- `wordbank-settings-page`: 独立的词库设置子页面，从游戏设置页入口进入，展示内置分组词库 + 已订阅自定义词库，选择结果持久化存储于 `wx.storage`
- `custom-wordbank`: 用户创建自定义词库分类，存储于云开发数据库；生成6位分享码供他人订阅；订阅者自动拉取最新词条；支持创建者编辑/删除；保存时通过云函数调用 `msgSecCheck` 过滤敏感词，不通过则拒绝保存并提示用户

### Modified Capabilities
- `werewolf-game`: 游戏设置阶段新增"词库设置"入口按钮，`getRandomWords` 调用时读取持久化的选中分类（含自定义词库）；核心游戏流程不变

## Impact

- `miniprogram/data/wordbank.js`：为每个分类添加 `difficulty` 字段；`getRandomWords(categories)` 接收分类对象数组（内置 + 自定义）
- `miniprogram/pages/wordbank-settings/`：新建独立页面，展示内置分组词库 + 已订阅自定义词库，读写 storage
- `miniprogram/pages/custom-wordbank/`：新建自定义词库管理页面（创建/编辑词条、生成分享码、输入分享码订阅）
- `miniprogram/pages/werewolf/index.js`：`startGame` 时从 storage 读取选中分类，合并内置+自定义词条后传入 `getRandomWords`
- `miniprogram/pages/werewolf/index.wxml` / `index.wxss`：新增"词库设置"按钮
- `miniprogram/app.json`：注册新页面
- **云开发**：新建 `wordbanks` 集合（字段：`shareCode`, `name`, `words[]`, `creatorOpenId`, `updatedAt`）
- **云函数** `saveWordbank`：接收词库数据 → 调用 `wx-server-sdk` 的 `security.msgSecCheck` 批量检测所有词条 → 通过后写入数据库并返回分享码
- Storage keys: `wordbank_selected_categories`（分类 id 数组）、`wordbank_subscriptions`（已订阅的云端词库 id 数组）
