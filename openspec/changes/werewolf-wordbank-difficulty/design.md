## Context

当前 `wordbank.js` 是一个单层字符串数组（73词），`getRandomWords` 不支持过滤。游戏设置页没有词库入口，用户无法控制词语来源。项目已开通微信云开发，现有唯一云函数 `quickstartFunctions` 为模板示例，未被业务使用。

## Goals / Non-Goals

**Goals:**
- 重构词库数据结构，支持分类 + 难度
- 扩充内置词库至 500 词（10类 × 50词）
- 新增独立"词库设置"页，持久化用户选择
- 新增自定义词库功能，支持云端存储、分享码、订阅同步
- 保存自定义词库时通过云函数调用 `msgSecCheck` 过滤敏感词

**Non-Goals:**
- 不做词库社区/排行榜/公开推荐
- 不做多设备同步（storage 仅本地）
- 不支持对他人词库的内容举报（后续可扩展）
- 不修改核心游戏流程（狼人/预言家/村民逻辑不变）

## Decisions

### 1. 词库数据结构：分类对象数组

**选择**：`wordbank.js` 改为导出分类对象数组，每个分类含 `id / name / difficulty / words[]`

```js
{ id: 'food', name: '食物', difficulty: 'easy', words: ['西瓜', ...] }
```

**原因**：词库完全本地，无需云端，加载零延迟；分类结构清晰，`getRandomWords` 可按传入分类列表合并词池后随机抽取。

**替代方案**：将词库也放云端 → 每局开始需网络请求，离线不可用，复杂度高，否决。

---

### 2. 词库设置持久化：wx.storage

**选择**：已选分类 id 数组存入 `wx.setStorageSync('wordbank_selected_categories', [...])`

**原因**：storage 永久保留，跨页面跨局有效，读写同步无异步复杂度，数据量极小（<100字节）。

**默认值**：首次读取为空时，写入 `easy` + `medium` 全部分类 id（向后兼容）。

---

### 3. 自定义词库：独立云函数 `wordbankSave`

**选择**：新建 `cloudfunctions/wordbankSave/`，负责敏感词检测 + 写库 + 返回分享码，不复用 `quickstartFunctions`。

**原因**：职责单一，便于独立部署和权限控制；`quickstartFunctions` 是模板代码，混入业务逻辑不利于维护。

**分享码生成**：6位大写字母+数字（去掉易混淆的 0/O/I/1），在云函数中循环生成直到不重复，碰撞概率极低（约 3400 万种组合）。

---

### 4. 自定义词库云数据库结构

```
集合：wordbanks
字段：
  _id           string   自动生成
  shareCode     string   6位分享码（唯一索引）
  name          string   词库名称
  words         string[] 词条列表
  creatorOpenId string   创建者 openid（用于鉴权编辑/删除）
  updatedAt     number   时间戳（订阅者判断是否需要拉取最新）
```

本地 storage `wordbank_subscriptions` 存 `[{ id, shareCode, name, cachedAt }]`，进入词库设置页时若 `updatedAt > cachedAt` 则重新拉取词条。

---

### 5. 词库设置页入口：navigateTo 独立页面

**选择**：点击"词库设置"按钮 `wx.navigateTo({ url: '/pages/wordbank-settings/index' })`，返回时 werewolf 页面通过 `onShow` 重新读取 storage。

**原因**：独立页面生命周期清晰，返回自动触发 `onShow` 刷新，无需事件总线。

---

### 6. 敏感词检测时机：保存时批量检测

**选择**：用户点击"保存词库"时，云函数将所有词条拼接（换行分隔）调用一次 `msgSecCheck`。

**原因**：减少 API 调用次数（500次/分钟限额），用户感知到的等待只有保存一次。不通过时返回错误，前端提示用户检查词条内容。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| `msgSecCheck` 误判正常词条 | 提示用户"包含敏感内容，请检查词条"，不指出具体词，让用户自行排查 |
| 分享码碰撞（极低概率） | 云函数循环重试最多5次，失败则返回错误让用户重试 |
| 订阅词库创建者删除后订阅者无词 | 本地保留最后一次缓存的词条，不影响已选中状态，但标记"已失效" |
| 词库设置页返回后 werewolf 未刷新选中状态 | werewolf `onShow` 中重新读取 storage 并更新 `selectedCategories` |
| 云函数冷启动延迟（首次保存慢） | 保存时显示 loading，超时5秒提示重试 |

## Migration Plan

1. 更新 `wordbank.js`：新结构向后兼容，`getRandomWords` 保持可用（无参数时默认全选）
2. 更新 `werewolf/index.js`：`onShow` 读 storage，`startGame` 时传分类给 `getRandomWords`
3. 新建页面：`wordbank-settings` → `custom-wordbank`，注册到 `app.json`
4. 新建云函数 `wordbankSave`，部署到云开发环境
5. 在云开发控制台创建 `wordbanks` 集合，设置 `shareCode` 唯一索引

## Open Questions

- 自定义词库单个词库最多允许多少词？（建议上限200词，防止滥用）
- 订阅他人词库后，是否允许在本地"克隆"一份独立编辑？（当前设计不支持，后续可加）
