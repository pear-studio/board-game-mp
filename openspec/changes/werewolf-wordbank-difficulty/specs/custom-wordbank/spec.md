## ADDED Requirements

### Requirement: 创建自定义词库
用户 SHALL 能在自定义词库管理页创建词库，输入名称（≤20字）并逐条添加词条（每条≤10字，上限200条，最少3条）。

#### Scenario: 成功创建词库
- **WHEN** 用户输入名称和至少3条词条后点击"保存"
- **THEN** 调用云函数 `wordbankSave`，显示 loading，成功后返回分享码并展示在页面上

#### Scenario: 词条不足时阻止保存
- **WHEN** 用户点击"保存"但词条不足3条
- **THEN** 提示"至少添加3个词条才能保存"，不调用云函数

#### Scenario: 词条超限时阻止添加
- **WHEN** 当前已有200条词条，用户尝试继续添加
- **THEN** 输入框禁用，提示"已达词条上限（200条）"

### Requirement: 敏感词过滤
云函数 `wordbankSave` SHALL 在写入数据库前调用 `security.msgSecCheck` 检测所有词条内容。

#### Scenario: 内容通过检测
- **WHEN** 所有词条均通过 `msgSecCheck`
- **THEN** 词库写入数据库，返回分享码给前端

#### Scenario: 内容未通过检测
- **WHEN** `msgSecCheck` 返回 `risky` 或 `review`
- **THEN** 云函数返回错误，前端提示"词条包含敏感内容，请检查后重新保存"，不写入数据库

### Requirement: 生成并分享分享码
自定义词库保存成功后 SHALL 生成唯一6位分享码（大写字母+数字，排除 0/O/I/1），用户可一键复制分享码。

#### Scenario: 复制分享码
- **WHEN** 用户点击分享码旁的"复制"按钮
- **THEN** 分享码写入剪贴板，提示"已复制"

### Requirement: 通过分享码订阅词库
用户 SHALL 能在自定义词库管理页输入6位分享码，订阅他人的词库。

#### Scenario: 成功订阅
- **WHEN** 用户输入有效分享码并点击"订阅"
- **THEN** 从云端拉取词库信息，写入本地 storage `wordbank_subscriptions`，订阅词库出现在词库设置页

#### Scenario: 分享码无效
- **WHEN** 用户输入的分享码在数据库中不存在
- **THEN** 提示"未找到对应词库，请检查分享码"

#### Scenario: 重复订阅
- **WHEN** 用户输入的分享码已在本地订阅列表中
- **THEN** 提示"你已订阅该词库"，不重复添加

### Requirement: 订阅词库自动同步
进入词库设置页时 SHALL 检查已订阅词库的云端 `updatedAt`，若比本地缓存新则自动拉取最新词条。

#### Scenario: 词库有更新
- **WHEN** 用户进入词库设置页，某订阅词库的云端 `updatedAt` 大于本地 `cachedAt`
- **THEN** 静默拉取最新词条，更新本地缓存，词条数量刷新显示

#### Scenario: 词库已删除
- **WHEN** 云端查询返回该词库不存在
- **THEN** 本地保留缓存词条，但标记该词库为"已失效"并在 UI 上提示

### Requirement: 编辑和删除自己创建的词库
词库创建者 SHALL 能重新编辑词条内容或删除整个词库，其他订阅者无法编辑。

#### Scenario: 创建者编辑词库
- **WHEN** 当前用户 openid 与词库 `creatorOpenId` 一致时，进入该词库详情
- **THEN** 显示编辑入口，可增删词条并重新保存（重新触发敏感词检测）

#### Scenario: 订阅者无编辑权限
- **WHEN** 当前用户不是词库创建者，进入该词库详情
- **THEN** 仅显示词条列表，无编辑/删除按钮
