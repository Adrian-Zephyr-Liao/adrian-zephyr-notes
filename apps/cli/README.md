# AZ Notes CLI

Monorepo 子包 `@adrian-zephyr-notes/cli`，源码在 `apps/cli`，命令名 `azn`。
覆盖现有管理员工作台全部 API：文章、图片、分类标签、编辑暂存、评论、留言、站点设置、公告、审计与管理助手。
逐项映射及边界见[管理员能力表](../../docs/admin-cli-capability-map.md)。模型和文章写作由调用 CLI 的 Agent 负责。
真实 SSH 授权、图文发布、清理及验证范围见[生产验收记录](../../docs/cli-admin-production-verification.md)。

要求 Node.js **22.18+**。本包由实际执行的 `vp create vite:library` 内置模板调整而来，
使用 `vite.config.ts` 的 `pack` 配置与 `vp pack` 生成可安装的 CLI。
当前 Vite+ 内置模板没有单独的 `vite:cli` 名称；没有引入另一套构建系统。
Commander 负责命令树、参数与帮助，Clack 负责授权提示和确认，picocolors 负责终端配色。

```bash
vp install
vp run blog --help                         # 仓库开发入口
vp run -F @adrian-zephyr-notes/cli build    # vp pack
node apps/cli/dist/azn.mjs --help           # 打包入口
```

`dist` 含运行所需的依赖与动态模块，复制整个目录即可运行，无需复制仓库或安装服务端依赖。
不要只复制 `azn.mjs` 而漏掉同目录模块。`package.json` 的 `bin` 指向 `dist/azn.mjs`；
可在包目录运行 `vp pm pack` 生成自包含包后安装；安装后的 CLI 无运行时 registry 依赖，无需发布 npm 即可供远端 Agent 使用。

本次生产部署也已在 SSH 宿主安装 `/usr/local/bin/azn`，可直接运行 `azn --help`。
该入口使用预置 Docker 镜像中的 Node，完整 CLI 产物独立存放，不依赖宿主 Node 或仓库依赖。
先进入文章文件所在目录，再调用 CLI；包装器只挂载当前目录树、只读 CLI 与调用用户的凭据目录，
所以绝对文件路径也应位于当前目录树。凭据遵循 `AZN_CONFIG_DIR`、`XDG_CONFIG_HOME` 和用户主目录，
本次验收授权已注销，正式使用需要重新登录。

## 登录与权限

API 生产根地址为 `https://zephyrai.site`。服务端和后台须部署支持本版权限的版本。
沿用现有 GitHub 管理员白名单，设备同意页仅接受管理员浏览器会话。

```bash
vp run blog auth login --server https://zephyrai.site --no-browser
vp run blog auth status
vp run blog auth whoami
vp run blog auth logout
# 只读管理员：
vp run blog auth login --server https://zephyrai.site --no-browser --read-only
# 保持旧文章操作范围：
vp run blog auth login --server https://zephyrai.site --no-browser --scope 'articles:read articles:write'
```

在自己的电脑或手机打开终端显示的网址，核对短码、账号和权限，再点击允许。
凭据保存在运行 CLI 的机器上；SSH 无需浏览器、端口转发、入站回调或 client secret。
默认申请 `admin:read admin:write`，`--read-only` 只申请 `admin:read`。
旧 `articles:read/write` 保持原范围，不能删除文章、上传图片或管理其他资源。
管理员同意页明确展示完整权限。新增 scope 不会扩展已有凭据，需重新授权。

设备授权有效期为 10 分钟，访问凭据有效期为 8 小时；不签发 refresh token。
轮询遵循返回间隔与 `slow_down`；拒绝、过期或取消后不会自动重新申请授权。
每次请求重新核对管理员身份、凭据有效期和撤销状态；助手每次工具前也重新鉴权。
`auth logout` 在服务器确认撤销后删除本地凭据，撤销失败时保留文件以便再次撤销。

默认文件 `${XDG_CONFIG_HOME:-~/.config}/azn/credentials.json`，目录权限 `700`、文件权限 `600`。
`AZN_CONFIG_DIR` 可设独立目录。也可注入 `AZN_SERVER_URL` 与 `AZN_ACCESS_TOKEN`，此时不读取本地文件。
不要把凭据放进参数、提示词或 Git。输出不含 access token 或 device code。
保存的凭据绑定服务器地址，不会因 `--server` 切换或 HTTP 重定向而转发。
远程使用 HTTPS，仅本机回环允许 HTTP。

## 人和 Agent 的输出

普通终端显示彩色结构化结果和交互确认；非终端 stdout 默认纯 JSON。
`--json` 强制机器模式，`--no-color` 关闭颜色；全局参数可放在子命令后。
成功结果写 stdout，错误写 stderr 并退出 `1`，错误形如：

```json
{ "error": { "code": "AUTH_REQUIRED", "message": "Run auth login first" } }
```

登录指引、图片上传回执和助手进度写 stderr；这些回执为 JSON 行，最终结果独立写 stdout。
`--json` 不弹出确认问题，需确认的操作必须明确传 `--yes`。
删除、标签合并、评论审核和助手决定都有显式确认；写操作从不自动重试。
网络断开或响应不完整时，结果可能未知，先查询相同资源再决定下一步。
列表分页上限为 50；助手历史每页上限为 100。命令详情用 `azn <组> <命令> --help` 查看。

## 写作与图片

```bash
vp run blog articles list --status DRAFT --query OAuth
vp run blog articles taxonomies
vp run blog images upload ./diagram.png --alt '授权流程'
vp run blog articles create --title '文章标题' --description '文章摘要' --file ./article.md --upload-images
vp run blog articles get ARTICLE_ID
vp run blog articles update ARTICLE_ID --file ./revision.md
vp run blog articles publish ARTICLE_ID
vp run blog articles update ARTICLE_ID --status DRAFT
```

单张上传返回 `key/url/mimeType/originalName/size` 及可嵌入的 `markdown`。
支持 PNG、JPEG、GIF、WebP，单张最多 10 MiB，按文件内容判断格式，并由服务器再次校验。
`--upload-images` 解析 Markdown 的行内图片与引用式图片，上传本地图片后替换地址再保存文章。
代码块、行内代码和远程图片不变；相同真实路径在本次操作中只上传一次。
它只改提交的正文，源 Markdown 与图片保持原样。

默认只允许 Markdown 所在目录内的图片。`--assets-root` 指定另一个允许的目录；
拒绝绝对路径、越界路径、逃出目录的符号链接和 `file:` URL。
从 stdin 或 JSON 获取正文时，需显式指定 `--assets-root`。
最多 100 个本地图片引用，所有本地图片合计最多 50 MiB；全部文件先验证，再开始上传。
不处理 HTML `img` 或下载远程图片；这与当前文章 Markdown 渲染能力一致。

也可以先生成独立的新文件，核对后再保存：

```bash
vp run blog images prepare ./article.md --output ./article-hosted.md --dry-run
vp run blog images prepare ./article.md --output ./article-hosted.md
vp run blog articles create --title '文章标题' --description '文章摘要' --file ./article-hosted.md
```

输出文件必须不存在，防止覆盖源稿。图片上传与文章保存分为多次请求，没有跨存储事务。
中途失败会留下已上传图片的回执；文章未提交时不会声称已保存，也不会自动重复上传或创建文章。
当前后台没有图片删除 API，CLI 不额外增加远端对象删除能力。

新文章始终为 `DRAFT`，只有 `articles publish` 显式发布。
更新保留原状态；**修改已发布文章会立即改变线上内容**。可先撤回为 `DRAFT`。
完整元数据通过 `--input article.json` 或 `--input -` 传入，命令行字段覆盖 JSON。
只接受已知文章字段，禁止在输入中用 `PUBLISHED` 绕过发布命令。

```json
{
  "title": "文章标题",
  "description": "摘要",
  "markdown": "# 正文",
  "categorySlug": null,
  "tagSlugs": [],
  "origin": "ORIGINAL"
}
```

`--file -` 从 stdin 读正文，不能与 `--input -` 同时使用。文本和 JSON 输入最多 1 MiB。
分类标签使用已有 slug，最多 5 个标签；`--category ''`、`--tags ''`、`--cover-image ''` 可清空。
转载使用 `--origin REPOSTED --source-name '来源' --source-url 'https://example.com/post'`。
发布要求非空摘要，转载还需有效来源。

## 其余管理员命令

| 命令组          | 支持动作                                                    |
| --------------- | ----------------------------------------------------------- |
| `dashboard`     | `get`，聚合现有只读接口                                     |
| `categories`    | `list/create/update/delete`                                 |
| `tags`          | `list/create/update/delete/merge`                           |
| `drafts`        | `get/save/delete`，当前管理员的云端编辑暂存，独立于正式文章 |
| `comments`      | `list/update`，审核前读取目标预览                           |
| `guestbook`     | `list/update`，显示、隐藏、软删除、恢复、置顶               |
| `site`          | `get/update`，主页、导航、社交链接                          |
| `announcements` | `list/update`，现有公告字段                                 |
| `audit`         | `list`，操作类型、执行者、关键词、分页筛选                  |
| `assistant`     | `capabilities/create/history/turn/run/stop/decide`          |

```bash
vp run blog categories create --name '技术' --slug tech
vp run blog tags merge SOURCE_UUID --target TARGET_UUID --yes
vp run blog drafts save --input ./editor-draft.json
vp run blog comments list --status HIDDEN
vp run blog comments update COMMENT_UUID --status VISIBLE --yes
vp run blog guestbook update MESSAGE_UUID --pinned true --yes
vp run blog site update --input ./site-settings.json --yes
vp run blog announcements update ANNOUNCEMENT_UUID --input ./announcement.json --yes
vp run blog audit list --actor USER --page-size 20
```

`site update` 接收完整 `{home,navigationItems,socialLinks}`，并沿用服务器校验。
云端暂存保存接收 `{articleId?,baseArticleUpdatedAt?,clientSavedAt,values}`，所有者来自服务器身份。
`values` 是编辑器完整字段集；可先读取现有暂存后修改，接口冲突会原样返回错误，CLI 不静默覆盖。
具体 JSON 字段见共享 contracts 与命令帮助。

助手运行使用现有 AG-UI SDK，结束后回读持久化结果，不能以流结束代替执行成功：

```bash
vp run blog assistant create
vp run blog assistant run CONVERSATION_UUID --message '查询最近的操作日志' --request-id task-001 --events
vp run blog assistant turn CONVERSATION_UUID task-001
vp run blog assistant stop CONVERSATION_UUID task-001
vp run blog assistant decide CONVERSATION_UUID ACTION_UUID --request-id task-001 --decision CONFIRM --yes
```

开始时 stderr 先给出会话 ID 与请求 ID；中断后用同一 ID 查询，不创建新的请求重复业务动作。
`--events` 只输出公开文本、工具名和终态，不输出模型内部内容。运行有 120 秒客户端预算，
取消后继续核对服务器收束结果。审批读取原动作预览，决定未知时仅核对或重试同一决定。
会话及动作所属关系、版本检查、审计和回执继续由服务器保证。
目前后台没有会话列表或会话删除接口，CLI 不虚构相应能力。

## 目录职责与验证

```text
src/
  cli.ts                 Commander 组装
  main.ts                进程入口、输出与退出码
  auth/                  设备授权、凭据保存与服务器绑定
  core/                  HTTP、输入、错误、确认与输出
  commands/              按业务能力注册命令
  content/               文章字段与 Markdown 图片处理
vite.config.ts           Vite+ pack 配置
bin/azn.mjs               仓库源码开发入口
```

共享 HTTP 类型来自 `packages/contracts`，CLI 不导入 Nest、Prisma 或后台组件。
所有命令复用既有 API 和审计行为；凭据权限必须在服务器检查，不能依赖 CLI 隐藏命令。

```bash
vp run -F @adrian-zephyr-notes/cli typecheck
vp run -F @adrian-zephyr-notes/cli build
vp test apps/cli/src
vp check
vp test
```

真实数据库/HTTP 回归使用 `ASSISTANT_TEST_DATABASE_URL` 指向独立已迁移测试库，不能指向业务库。
首版真实 SSH 发布验收见[生产记录](../../docs/cli-production-verification.md)，该记录标明版本，
不代表扩展版的所有权限已在生产改写验证。
