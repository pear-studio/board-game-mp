## 1. 词库数据重构

- [ ] 1.1 重写 `miniprogram/data/wordbank.js`：将数据结构改为分类对象数组，每项含 `id / name / difficulty / words[]`
- [ ] 1.2 填充10个分类各50词（easy×3 / medium×4 / hard×3），共500词
- [ ] 1.3 更新 `getRandomWords(n, categoryIds?)` 函数，支持按 categoryIds 过滤词池

## 2. 游戏流程接入新词库

- [ ] 2.1 `werewolf/index.js` `onShow` 中读取 storage `wordbank_selected_categories`，无记录时写入默认值（easy + medium 全部分类 id）
- [ ] 2.2 `startGame` 时从 storage 读取已选分类，合并内置词条 + 订阅词库缓存词条，传入 `getRandomWords`
- [ ] 2.3 在游戏设置页 WXML 中"开始游戏"按钮上方添加"词库设置"入口按钮
- [ ] 2.4 为"词库设置"按钮添加 WXSS 样式

## 3. 词库设置页（内置词库分组）

- [ ] 3.1 新建 `miniprogram/pages/wordbank-settings/` 目录及四文件（js/wxml/wxss/json）
- [ ] 3.2 在 `app.json` 中注册 `pages/wordbank-settings/index`
- [ ] 3.3 `onLoad` 读取 storage，初始化 `selectedCategories` 状态；无记录时写入默认值
- [ ] 3.4 渲染三个难度分组（简单/中等/困难），每组列出分类卡片（名称 + 词条数）
- [ ] 3.5 实现单个分类勾选/取消，点击后更新 data 并写入 storage
- [ ] 3.6 每个难度组实现"全选"/"全取消"批量操作按钮
- [ ] 3.7 实现"至少保留一个分类"的边界保护，阻止全部取消并提示

## 4. 词库设置页（自定义词库区域）

- [ ] 4.1 在页面底部渲染"自定义词库"区域，读取 storage `wordbank_subscriptions` 展示已订阅词库
- [ ] 4.2 已订阅词库显示名称、词条数、分享码；支持勾选/取消纳入词池
- [ ] 4.3 无订阅时展示"创建或订阅词库"引导卡，点击跳转自定义词库管理页
- [ ] 4.4 `onShow` 时检查订阅词库云端 `updatedAt`，若有更新则静默拉取最新词条并更新缓存

## 5. 自定义词库管理页

- [ ] 5.1 新建 `miniprogram/pages/custom-wordbank/` 目录及四文件
- [ ] 5.2 在 `app.json` 中注册 `pages/custom-wordbank/index`
- [ ] 5.3 渲染"创建词库"表单：词库名称输入（≤20字）+ 词条列表（增/删）
- [ ] 5.4 实现词条输入校验：单条≤10字，上限200条（超限禁用输入框并提示）
- [ ] 5.5 "保存"按钮：词条<3条时提示并阻止；满足条件时调用云函数 `wordbankSave`，显示 loading
- [ ] 5.6 保存成功后展示分享码，提供"一键复制"按钮（`wx.setClipboardData`）
- [ ] 5.7 渲染"订阅词库"区域：输入6位分享码，点击"订阅"按钮
- [ ] 5.8 订阅逻辑：查询云端 → 校验有效性 → 去重检查 → 写入 storage `wordbank_subscriptions`
- [ ] 5.9 已订阅词库列表：区分创建者（显示编辑/删除）与订阅者（仅查看）
- [ ] 5.10 创建者编辑：回填词条列表，修改后重新调用 `wordbankSave` 更新（含敏感词检测）
- [ ] 5.11 创建者删除：调用云函数删除云端记录，从本地 storage 移除，词库设置页同步刷新

## 6. 云函数 wordbankSave

- [ ] 6.1 新建 `cloudfunctions/wordbankSave/` 目录，初始化 `package.json`（依赖 `wx-server-sdk`）
- [ ] 6.2 实现敏感词检测逻辑：将所有词条换行拼接后调用 `security.msgSecCheck`
- [ ] 6.3 实现唯一6位分享码生成（字符集排除 0/O/I/1），碰撞时最多重试5次
- [ ] 6.4 实现写库逻辑：新建词库写入 `wordbanks` 集合；编辑时更新 `words` 和 `updatedAt`
- [ ] 6.5 在云开发控制台创建 `wordbanks` 集合，并对 `shareCode` 字段设置唯一索引
- [ ] 6.6 部署云函数到云开发环境
