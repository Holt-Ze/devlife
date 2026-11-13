# 完整 36 季度数据库与软件初始化

采用原生 PostgreSQL 18.6、Knex 3.3.0 和 pg 8.23.1。数据库为当前实际软件建立，包含 18 张业务表、98 个字段、21 条外键。现有 TypeScript 数据已真实迁入持久实例：98 个事件、25 个选项、16 个自动分支、338 条季度池记录、28 个天赋、20 个成就、6 种职业出身、18 个出身天赋关联和 6 类结局。源快照完整保留 37 个季度位置（0 到 36）。

## 启动

在仓库根目录运行：

```powershell
pnpm install --frozen-lockfile
pnpm setup:local
pnpm start:local
```

打开 http://127.0.0.1:8787 。首次安装需要下载固定版本的 Windows x64 PostgreSQL 二进制；程序通过 npm 完整性值核验下载。数据库位于 `.local/postgres18`，监听 `127.0.0.1:55432`，数据库名 `devlife`，UTF-8，Asia/Shanghai 时区。不注册系统服务，不更改系统 PATH，不使用或清空已有数据库。

`setup:local` 自动导出源数据、初始化实例、创建账号、应用迁移、装载种子、设置网页为数据库模式并构建网页。重复执行保留已有玩家档案和已完成历史。`start:local` 启动专用实例和网页服务；终端 Ctrl+C 可结束网页服务。`pnpm db:stop` 停止专用数据库，数据保留。

Windows 自动配置入口为 `scripts/local-postgres.mjs`。其他平台可提供现有 PostgreSQL 的 DATABASE_URL 执行迁移、种子及文档生成；本次未验证其他平台的自动安装。

## 账号与凭据

`devlife_owner` 负责迁移；`devlife_app` 为非超级用户运行账号，按表及列授予权限。运行账号不能更改源目录或发布快照，不能读取 password_hash 或创建表。

软件账号 `local_admin` 与 `local_player` 在初始化时创建，独立随机口令保存在 `.local/runtime.json`，表内为随机盐 scrypt 哈希。该目录仅当前用户与 SYSTEM 可访问且不入 Git。当前软件为本机单玩家模式，自动使用 local_player，不提供公网登录入口。切勿把数据库凭据或该文件上传、截图或加入报告。

## 数据迁移与种子

`data/game36-source.json` 由 `scripts/export-source.mjs` 使用仓库已有 TypeScript 编译器从实际源 Map/数组导出。未使用旧 Excel 或旧 24 季度示例。`source_id` 保留事件原整数 ID，同时使用 UUID 支持历史模型；所有结果、分支、事件池与出身天赋引用先验证后装载。

当前种子为 `seeds36/001_source.mjs`，原 `seeds/001_demo.mjs` 仅保留作历史参考，不进入当前运行配置。重复种子同步只读源内容目录，不重置账号、玩家档案、发布版本或生涯历史；相同内容的校验和只生成一份快照。目录变化会生成新快照，已有生涯仍引用原版本。

```powershell
pnpm db:export-source
pnpm db:migrate
pnpm db:status
pnpm db:seed
```

`db:migrate` 自动读取专用本机连接；显式 DATABASE_URL 优先。直接执行种子需设置 SEED_ADMIN_PASSWORD 和 SEED_PLAYER_PASSWORD（各至少 12 字符）；自动 setup:local 已从私有配置提供这些值。没有隐含默认口令。

三份有序迁移：001 保留原五表基线；002 扩展完整 36 季度关系；003 单独修订注释。不要修改已部署迁移，新增变更请添加新文件。`db:rollback` 可能删除业务表；002 检测到生涯历史时拒绝无损降回 24 季度。回滚与重放只在独立空验证库执行，正常升级应先备份、使用新迁移前进。

## 软件接入

网页的 `storage/postgres.ts` 在启动时从 `/api/content` 读取 PostgreSQL 发布快照并填充原有内容 Map，再从 `/api/profile` 还原跨局档案。`.env.local` 中的 VITE_STORAGE_MODE 自动设置为 postgres；数据库凭据不进入网页。

首次未初始化时，仅从当前浏览器同源的 `devlife:v1:profile` 和 `devlife:v1:unique` 读取旧值，提交 `/api/profile/import`，保存原始 JSON 审计及规范化关联。原本地值保留。未知 ID 或损坏 JSON 拒绝导入，不覆盖原始档案。跨浏览器或跨端口 localStorage 无法自动读取，本次没有声称迁走未访问到的私人历史档案。

保存档案时先锁定 player_profiles 行并检查 expectedVersion，再原子更新关联。生涯完成后将原 GameState（Set/Map 转为 JSON 数组）与决策归档到 career_runs/run_actions。当前结果仍由客户端引擎计算，后端不提供防作弊或权威结算保证；进行中刷新续玩和 RNG 恢复尚未实现。MNY 保留为游戏积蓄点数。

## 验证与备份

```powershell
pnpm db:test
pnpm db:test:real
pnpm db:verify-persistence
pnpm typecheck
```

快速测试使用临时 PGlite；真实测试使用当前原生实例中的独立随机名称验证库。真实测试覆盖源定义一致、幂等种子、外键、唯一键、发布快照不可变、事务回滚、导入备份、档案乐观锁、并发仅一次成功、API 以及运行账号权限。不会把验证档案写入主数据库。

`verify-persistence` 在可重复读事务中逻辑备份全部 18 张业务表，恢复到隔离库后逐行比较规范化哈希，再停止并重启专用实例检查数据一致。运行该命令会短暂重启数据库，应在没有进行中保存时执行。备份位置 `.local/backups/devlife-36-complete.json`，含账号哈希和玩家数据，保持私有。该格式是已实测的项目逻辑备份，不是 pg_dump 原生格式。

## 图、字典与 PDF

`pnpm db:docs` 必须连接已迁移的实际 PostgreSQL，从元数据生成完整 ER 图、分域图、Mermaid、Markdown、JSON、中文 CSV 和 HTML；tbls 在 Windows 下可通过原安装脚本安装。PDF 使用这些元数据及实际验证摘要生成，位于 `output/pdf/`。

文档入口：`docs/database/index.html`；中文字段字典：`docs/database/数据字典.md`；完整建库回放 SQL：`docs/database/schema.sql`。PDF 内嵌结构、图源、源内容种子和公开核验摘要，不包含密码或真实个人数据备份。

ER 排版采用 Viz.js（Graphviz）；若需要重排当前矢量图，给 `VIZ_MODULE` 指定可用 @viz-js/viz 模块入口后执行 `scripts/draw-er.mjs`。字段与物理关系以实际 metadata 为准，不能用手工框图替代迁移验证。
