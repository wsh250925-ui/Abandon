# 急救学习小程序：数据结构与首次启用

环境 ID：`cloud1-3gallbdh0047145a`。本项目使用微信·云开发（`wx.cloud` + `wx-server-sdk`），不需要单独数据库服务器。

## 页面与路径

- 四个原生 Tab：`pages/home/index`、`pages/aed/index`、`pages/study/index`、`pages/profile/index`。
- 中央 120 为自定义 TabBar 按钮，不是第五个页面；持续按住约 3 秒后震动、确认，再交由系统拨号界面处理。
- 二级页：`pages/quiz/index`（题组与答题）、`pages/ranking/index`（日/周/月/总榜）、`pages/lesson/index`（视频播放）、`pages/article/index`（图文阅读）、`pages/admin/index`（开发者后台）。
- AED 导航已接入：前端使用微信原生地图，`aedApi` 云函数调用百度地点检索和轻量级步行/驾车路线服务；百度 AK 只放在云函数环境变量中。

## 数据集合

| 集合 | 主要字段 | 用途 |
| --- | --- | --- |
| `users` | `_id`=OpenID、`nickname`、`avatarUrl`、`anonymousInRanking`、`disabled` | 微信身份与展示资料；不收集实名/学校身份 |
| `courses` | `title`、`description`、`coverFileId`、`published`、`order` | 课程容器，无课程分类 |
| `lessons` | `courseId`、`title`、`videoFileId`、`duration`、`published` | 视频课时，视频文件存云存储 |
| `articles` | `title`、`summary`、`content`、`coverFileId`、`published` | 图文课 |
| `quizSets` | `title`、`description`、`published` | 题组 |
| `questions` | `setId`、`stem`、`options`、`answer`、`explanation`、`order` | 选择题；`answer` 为从 0 开始的选项序号 |
| `quizAttempts` | `openid`、`setId`、`answers`、`score`、`at` | 每次提交的历史记录 |
| `quizBest` | `openid`、`setId`、`score` | 每套题的历史最高分，总榜使用 |
| `lessonProgress` | `openid`、`lessonId`、`intervals`、`uniqueSeconds` | 已观看区间合并，防重复累计 |
| `dailyStudy` | `openid`、`day`、`seconds` | 每日新增有效学习秒数，供时长榜使用 |
| `adminAuditLogs` | `openid`、`action`、`collection`、`targetId`、`at` | 管理操作留痕 |
| `settings` | `key`、`value` | 后续开关与文案配置 |

### 图文图片的存储与渲染

图文正文由后台 `editor` 组件生成 HTML。管理员点击“在光标处插入图片”时，流程如下：

1. 图片上传到云存储 `admin-media/articles/`。
2. 编辑器暂时插入云存储临时 HTTPS 地址，便于管理员预览。
3. 点击“保存”时，后台把编辑器中的临时地址替换成永久 `cloud://` FileID 后写入 `articles.content`。
4. 用户打开图文详情页时，先把当前云存储域名中的旧签名 URL 恢复为 FileID，再按图文顺序拆分正文。文字由 `rich-text` 显示，图片由原生 `<image>` 显示，优先下载新临时文件并提供失败重试。

正文图片应保存永久 FileID。当前项目云存储域名中的旧签名地址可自动恢复，不必重新上传；管理员重新保存旧文章时会转存永久 ID。只有原文件已删除或原地址不能识别时，才需要重新插图。详见 `docs/ARTICLE_MEDIA.md`。

媒体解析工具位于 `miniprogram/utils/media.js`。原生图片优先使用本地临时文件，后台编辑器预览使用 `{ preferRemote: true }` 获取新的临时 HTTPS 地址。正文地址恢复、保存与拆分由 `miniprogram/utils/article-content.js` 统一负责。

所有业务读写均通过 `learningApi` 云函数，前端不直接访问数据库。管理员权限由云函数环境变量 `ADMIN_OPENIDS` 中的 OpenID 白名单判断，**不是**前端页面是否可见决定的。建议对上表全部集合在云开发控制台设置 `security/database.rules.json` 所示规则（客户端读写均拒绝，云函数仍可操作）。

## 首次启用（需要开发者在微信开发者工具/云开发控制台操作）

1. 在微信开发者工具打开 `D:\health_program`，确认 AppID 与环境 ID 正确。
2. 右键菜单没有部署项时，直接在项目目录执行下面的命令（开发者工具服务端口以你设置的 `38036` 为例）：
   `E:\微信web开发者工具\cli.bat cloud functions deploy --env cloud1-3gallbdh0047145a --appid wx7eaa0b1a27dfdae0 --paths D:\health_program\cloudfunctions\learningApi --remote-npm-install --port 38036`
   本地依赖只用于本地校验，云端仍需部署。
3. 在云函数配置中新增环境变量 `ADMIN_OPENIDS`。先在开发者工具调用 `learningApi` 的 `identity` 操作，或打开 `pages/admin/index`，复制显示的当前 OpenID；把它填入 `ADMIN_OPENIDS`。多位开发者用英文逗号分隔。修改后按控制台提示重新部署/发布配置。
4. 在云开发数据库控制台，将业务集合权限设为仅服务端可读写。若集合尚不存在，先由管理员进入后台点击“初始化”。初始化会创建 12 个集合，并插入两套各 5 道示例选择题、1 门演示课程与 1 节演示视频记录；重复点击不会重复插入。
5. 在云存储控制台设置权限：普通用户可读，只有管理员 OpenID 可写。`security/storage.admin-write.template.json` 是模板，须把占位文字替换为真实 OpenID 后再应用。否则**不要**启用后台的客户端上传按钮；仅靠隐藏页面不能保护存储写入。
6. 项目根目录 `demo-aed.mp4` 是 8 秒蓝底测试视频，画面明确标注非教学内容。把它上传到云存储，复制得到的 `cloud://` FileID，在后台“视频课 → demo_lesson”中填入 `videoFileId` 并保存。正式教学视频需要专家审核内容后再发布。
7. 进入“学习 → 习题测试”检查两套题；播放演示视频后到“我的”和排行榜核对学习数据。真机长按 120 按钮测试时，**不要误点确认拨号**。

## 后台操作

管理员入口在“我的”页，仅白名单用户可见；即便普通用户直接访问 `pages/admin/index`，云函数也会拒绝所有管理操作。后台可管理课程、视频课、图文、题组、题目、用户展示资料和配置；答题记录、最佳成绩、观看进度、每日时长、操作日志可查看但不可直接改写。选择类型 → 新建或点记录 → 使用表单编辑，特殊字段也可在高级 JSON 区修改 → 保存。需要向用户展示的内容设置 `published: true`。删除不可恢复，请先核对记录 ID。用户记录不允许在后台删除。

上传视频/封面时，后台先写入云存储并把 FileID 放进编辑器，**还需点击保存**。当前上传控件单文件限制 100MB；更大的视频可经云存储控制台上传后粘贴 FileID。50GB 是资料总量，不建议打进小程序代码包。正式大规模视频播放如出现带宽/流畅度问题，评估腾讯云点播与转码。

## 当前边界与下一阶段

- “有效学习时长”是正常客户端播放事件形成的去重观看区间；它能避免拖动与重复观看重复计时，但客户端数据不能作为防作弊的绝对证明。排行榜不应用作高风险考核。
- AED 地图已接入百度 POI 与路线时间接口；小程序位置隐私声明、接口权限和真机流程仍须验收。独立首次进入隐私流程、成就与报告分享仍需后续安排。微信昵称和头像由用户在“我的”页主动提供；不能静默获取。
- 前端使用原生小程序组件；目前不依赖 TDesign 的 `usingComponents` 或“构建 npm”。项目配置关闭旧版 ES6/增强转译，以避开开发者工具缺失 Babel helper 导致的空白页。
- 500–1000 人规模建议给 `dailyStudy.day`、`quizAttempts.at`、`questions.setId`、`lessonProgress.openid` 等查询建立索引，并在上线前做真机与并发测试。现在排行榜按需聚合，数据增长后应转为定时榜单快照。
- 云环境尚需在你登录的微信开发者工具内完成部署与权限设置；本地文件写入本身**不会**自动创建线上数据库。
- AED 云函数部署：右键 `cloudfunctions/aedApi` 选择“创建并部署：云端安装依赖”，然后在该函数配置中设置 `BAIDU_MAP_AK`。完整说明见 `cloudfunctions/aedApi/README.md`。
