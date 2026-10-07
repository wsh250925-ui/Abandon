# Git 仓库与开发交接

仓库：<https://github.com/wsh250925-ui/Abandon>。

该仓库在首次上传时为公开仓库。源码、测试、权限模板及项目文档可以查看；不要提交真实用户数据、数据库导出、管理员白名单、百度 AK、访问令牌或私钥。AppID 和云环境 ID 是项目标识，并不授予云端访问权限，但云端必须正确配置服务端鉴权与存储权限。

## 获取和运行

1. 安装 Git 和微信开发者工具，执行 `git clone https://github.com/wsh250925-ui/Abandon.git`。也可在 GitHub 下载 ZIP 后解压。
2. 用微信开发者工具导入下载后的项目根目录，选择实际有权限使用的 AppID。无需保留原电脑的 `D:\health_program` 路径。
3. 先阅读根目录 `DATA_AND_DEPLOY.md`，再阅读 `cloudfunctions/aedApi/README.md`。源码中保留当前项目的 AppID、云环境 ID 及图文旧地址恢复配置；访问原环境需要项目负责人授权，不要把克隆代码当作获得云端权限。
4. 当前业务页面使用原生小程序组件，不依赖生成的 TDesign npm 目录；仓库不包含 `node_modules` 和 `miniprogram_npm`。需要安装根目录依赖时执行 `npm ci`；`learningApi` 本地依赖可在 `cloudfunctions/learningApi` 中执行 `npm ci`，云端部署仍选择“云端安装依赖”。`aedApi` 首次本地安装使用 `npm install`。
5. 用自己的开发者工具配置编译模式等个人设置。`project.private.config.json` 已排除，不影响源码交接。
6. 云函数、数据库、云存储文件与云函数环境变量不会自动随 Git 克隆。按部署文档完成云环境接入，在云端配置 `ADMIN_OPENIDS` 和 `BAIDU_MAP_AK`，不要把真实值填入源码。
7. 执行 `node --test tests/*.test.js` 运行自动化测试，然后在已授权云环境和手机上验收。自动化模拟结果不能代替真实文件权限、定位、地图与播放验证。

若另建云环境，需要一起检查 `project.config.json` 的 AppID、`miniprogram/app.js` 的环境 ID，以及 `miniprogram/utils/article-content.js` 的旧云存储域名恢复配置。旧环境的媒体与数据还需单独迁移或授权；仅修改环境 ID 不会迁移文件。

## 三人协作建议

主分支 `main` 保持可运行版本。前端和后端成员分别在功能分支提交，经其他成员检查后合并；产品负责人维护需求、任务状态与验收证据。提交前先检查 `git status` 和 `git diff --cached`，确认没有敏感文件。源码合并与云函数部署是两件事，涉及云端修改时同时更新部署记录。

仅协助编写工作安排的人，可以直接阅读 `docs/TEAM_PLAN.md` 及同目录 Word 文档，无需访问云环境。公开仓库不默认授予修改权；如需其他成员直接推送，由仓库所有者在 GitHub 设置中邀请协作者。

## 本次纳入与排除

- 纳入：小程序源码、云函数源码、依赖清单和锁文件、权限模板、测试、维护文档、三人分工 Word 文档、约 65KB 的非教学演示视频。
- 排除：依赖缓存、生成的 npm 组件目录、个人开发者工具配置、环境变量文件、密钥与临时导出目录。
- 不包含：线上用户记录、正式视频库、图文云存储文件及云函数中的真实环境变量。

`.gitignore` 只是降低误提交风险，不能自动识别代码里手写的密钥。生产配置始终通过受控渠道交接。
