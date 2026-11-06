# AZ Notes CLI

博客 CLI 是 monorepo 子包 `@adrian-zephyr-notes/cli`，位于 `apps/cli`，命令名为 `azn`。
它把宿主 Agent 写好的 Markdown 保存到博客，复用博客的文章校验、分类标签与操作日志。
模型选择、资料检索和文章生成由调用它的 Agent 负责，CLI 不另外创建模型会话。

要求 Node.js **22.18 或以上**。使用 Node 原生 TypeScript 支持，无需先构建，也没有新增运行时依赖。

```bash
vp install
node apps/cli/bin/azn.mjs --help
# 仓库根目录也提供快捷脚本：
vp run blog --help
```

## OAuth2 登录，包括远端 Agent / SSH

服务端与后台需要先更新到本次版本并应用数据库迁移。沿用现有 GitHub OAuth 配置与
`ADMIN_GITHUB_LOGINS` 管理员白名单；`ADMIN_FRONTEND_ORIGIN` 必须是浏览器可访问的后台地址。

在运行 Agent 的那台机器上执行，`--server` 填博客 **API 服务的根地址**：

```bash
node apps/cli/bin/azn.mjs auth login --server https://api.example.com --no-browser
```

终端会显示验证网址与短码。在自己电脑或手机的浏览器打开该网址，使用 GitHub 管理员账号登录，
核对网页短码与终端一致，再明确点击允许。远端 CLI 会轮询等待确认，随后把凭据保存到**远端机器**。
SSH 不需要端口转发、回调监听、图形界面或 client secret。

设备授权遵循 [OAuth2 Device Authorization Grant / RFC 8628](https://www.rfc-editor.org/rfc/rfc8628)。
短码请求 10 分钟后过期；轮询遵守服务端间隔与 `slow_down`。允许访问文章的凭据有效期为 8 小时，
到期需要重新登录。首版不签发 refresh token。

```bash
node apps/cli/bin/azn.mjs auth status
node apps/cli/bin/azn.mjs auth logout
# 仅查询时可申请只读权限：
node apps/cli/bin/azn.mjs auth login --server https://api.example.com --no-browser --read-only
```

`auth logout` 撤销当前凭据并删除本地保存。服务端每次请求重新检查管理员身份。
凭据只允许读取、创建、修改和发布文章，不能删除文章，也不能操作评论、留言、站点设置或后台助手。

默认凭据文件是 `${XDG_CONFIG_HOME:-~/.config}/azn/credentials.json`，目录权限 `700`、文件权限 `600`。
可以通过 `AZN_CONFIG_DIR` 指定独立目录。文件中含有凭据，应留在运行 CLI 的受控账号下。
CLI 输出不包含 access token 或 device code；验证短码可以展示给进行授权的用户。

也可由运行环境的密钥管理系统注入 `AZN_SERVER_URL` 与 `AZN_ACCESS_TOKEN`，此时不读取本地凭据。
不要把 token 放进命令行参数、Agent 提示词或 Git。保存的凭据绑定登录时的服务地址，
`--server` 切换到其他服务器不会转发原凭据，HTTP 重定向也不会转发凭据。
远程地址必须使用 HTTPS，HTTP 仅允许本机回环地址。

## Agent 写文章

推荐顺序：读取已有文章与分类标签、生成 Markdown、保存草稿、读取结果核对，再按用户要求显式发布。
命令默认以 JSON 输出到 stdout；错误是 stderr 中的 `{ "error": { "code", "message", "status"? } }`，
退出码为 `1`。登录过程的网址和短码也写 stderr，成功后 stdout 只有 JSON。

```bash
node apps/cli/bin/azn.mjs articles list --status DRAFT --query OAuth
node apps/cli/bin/azn.mjs articles taxonomies
node apps/cli/bin/azn.mjs articles create \
  --title "用设备授权让远端 Agent 操作博客" \
  --description "实现过程、权限边界和实际验证" \
  --file ./article.md
```

创建永远保存为 `DRAFT`，返回文章 `id`、`slug`、`status` 等服务器结果。
`--file -` 可以从标准输入接收 Markdown：

```bash
cat article.md | node apps/cli/bin/azn.mjs articles create --title "文章标题" --file -
node apps/cli/bin/azn.mjs articles get <id>
node apps/cli/bin/azn.mjs articles update <id> --file ./article-v2.md --description "更新摘要"
node apps/cli/bin/azn.mjs articles publish <id>
```

修改仅传入指定字段，默认保留现有状态；**修改已发布文章会立即改变线上内容**。
需要先撤回时，使用 `articles update <id> --status DRAFT`。
发布前必须有非空摘要，转载文章还需要来源名称与来源网址。

完整元数据可以通过 `--input article.json` 或 `--input -` 传入，命令行字段覆盖同名 JSON 字段。
仅接受现有文章 API 字段，创建时不接受 `PUBLISHED`，发布必须使用 `articles publish`。

```json
{
  "title": "文章标题",
  "description": "文章摘要",
  "markdown": "# 正文\n\n内容",
  "categorySlug": null,
  "tagSlugs": [],
  "origin": "ORIGINAL"
}
```

分类、标签必须使用博客已存在的 slug。最多 5 个标签。用 `--category ''`、`--tags ''`、
`--cover-image ''` 清空对应字段。转载元数据可用 `--origin REPOSTED`、`--source-name`、
`--source-author` 与 `--source-url` 指定。

CLI 不自动重试写操作。遇到超时或断线，提交结果可能未知，应查询文章列表/详情核对后再决定下一步，
避免再次创建相同文章。HTTP 正文大小限制沿用服务器配置；服务器拒绝时不会拆分或截断文章。

## 服务端接口

| 接口                                 | 作用                                                 |
| ------------------------------------ | ---------------------------------------------------- |
| `POST /api/oauth/device/code`        | form：`client_id=azn-cli`、`scope`；签发设备码和短码 |
| `GET /api/oauth/consent?user_code=…` | 浏览器管理员会话查看待授权请求                       |
| `POST /api/oauth/authorize`          | 浏览器会话 + 后台 Origin；明确允许或拒绝             |
| `POST /api/oauth/token`              | form：device grant；等待中返回标准 OAuth 错误        |
| `GET /api/oauth/me`                  | Bearer 凭据身份、权限和到期时间                      |
| `POST /api/oauth/revoke`             | form：`client_id`、`token`；撤销凭据                 |
| `/api/admin/articles`                | 复用文章查询、创建和修改接口                         |

权限为 `articles:read` / `articles:write`；设备码与 access token 在数据库中仅保存哈希。

## 验证

```bash
vp run -F @adrian-zephyr-notes/cli typecheck
vp test run apps/cli/src
vp check
vp test
```

数据库回归使用显式 `ASSISTANT_TEST_DATABASE_URL` 指向已迁移的独立测试库，
沿用服务端 `test:e2e` 入口，不使用当前业务数据库。
