# 博客 CLI 生产发布与 SSH 实机验收

2026-11-06 完成发布与验收，本文时间均为 Asia/Shanghai。API 根地址为
<https://zephyrai.site>，设备确认页为 <https://admin.zephyrai.site/oauth/device>。

发布版本为 `fa1a1d622adf6be8c1ba86e2e877fd37c0561acb`，包含 CLI 功能提交
`0dadf54d126ad18198478d4e77f4b3ffbcc3ea82` 及已验收的发布修复。
本次更新 server、admin；API 采用单实例重启，后台采用健康候选切流。
22:31:45 完成服务切换。

## 实际操作与结果

远端通过受信 SSH 连接到生产服务器，使用预构建 server 镜像内的 Node 24 运行
`apps/cli/bin/azn.mjs`。CLI 源码只读挂载，凭据使用独立私有目录，未映射入站端口。
浏览器使用本机现有的 GitHub 管理员会话确认该次设备码。

| 操作                                                     | 观察到的结果                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `auth login --server https://zephyrai.site --no-browser` | 远端显示网址与短码，等待浏览器确认；确认后返回 `authenticated: true`                  |
| `auth status`                                            | 身份为 `Adrian-Zephyr-Liao`，权限为 `articles:read articles:write`                    |
| `articles create`                                        | 创建唯一临时文章，状态 `DRAFT`，正文回读一致                                          |
| 草稿公开检查                                             | 公共 API、文章页面均为 HTTP 404                                                       |
| `articles update`                                        | 同一 ID、slug 修订正文和摘要，保持 `DRAFT`                                            |
| 权限边界                                                 | Bearer 删除该文章返回 403；访问站点配置返回 401；文章保持完整                         |
| `articles publish`                                       | 返回 `PUBLISHED` 及有效 `publishedAt`                                                 |
| 发布结果                                                 | 公共 API、实际页面均为 200；正文 SHA256、标题、摘要和唯一标记一致；浏览器实际打开成功 |
| 审计                                                     | 实际管理员产生 `DRAFT → DRAFT → PUBLISHED → DRAFT` 的创建与更新记录                   |
| `articles update --status DRAFT`                         | 测试文章撤回，公共 API、文章页面恢复 404                                              |
| `auth logout`                                            | 返回撤销成功，凭据文件删除，原凭据访问 `/api/oauth/me` 返回 401                       |

测试文章 ID 为 `9bfb4505-6fed-4de8-80c3-50b33ba9c13f`，slug 为 `30766853`，
标题为“博客 CLI 设备授权验收（临时测试）6a5ee39a”。已保留为
[后台草稿](https://admin.zephyrai.site/articles/9bfb4505-6fed-4de8-80c3-50b33ba9c13f/edit)，
用于复核，当前公共地址不提供文章内容。

修订正文 SHA256 为
`9043fd3e4b8f60d12f3626ae67ef7b1db24abf20f9851a25a19f4137cbe6bba2`。
发布及撤回均操作同一篇文章。数据库核对确认原有 5 篇文章的状态、正文内容哈希和更新时间完全一致。
凭据目录权限为 `700`，文件权限为 `600`；验收结束后该凭据已撤销并删除。

## 发布与可用性

本机构建 linux/amd64 镜像，校验归档 SHA256、镜像 ID、平台及版本标签后上传。
源码仅快进，保留实际生产配置；发布全程持有两把共享发布锁。
API 重启前确认活动助手请求为 0，并保存、校验私有 PostgreSQL 备份。

后台切流使用精确配置的 stdin reload，再从 Caddy 实际运行配置确认新 upstream。
确认网站、API、ERP 路由保持一致后，排空并停止旧后台。
旧 API 镜像、旧后台容器及私有备份保留用于回退。

22:25:29–22:39:08 的服务器本地 HTTPS 探测结果如下，每项 369 次：

| 入口     | HTTP 200 | 其他结果                |
| -------- | -------- | ----------------------- |
| 管理后台 | 369      | 0                       |
| ERP      | 369      | 0                       |
| API      | 366      | 单实例重启期间 3 次 502 |
| 主站首页 | 365      | 同一窗口内 4 次 500     |

异常集中在 22:31 左右约 10 秒的采样窗口；API 重启时主站首页依赖后端查询，因此也受影响。
恢复后的完整 CLI 验收及后续探测均成功。本次属于有短暂 API 维护窗口的发布，不能称为零停机发布。

镜像加载、服务切换及整个验收期间，网站、数据库、Caddy、ERP 容器没有新增重启或 OOM。
新 API 和新后台均健康，重启计数为 0。探测期间最低可用内存约 677 MiB。
临时验收容器和探测进程已结束。

## 正式使用

在具备 Node.js 22.18+ 与 Vite+ 的仓库根目录运行：

```bash
vp run blog auth login --server https://zephyrai.site --no-browser
vp run blog articles create --title "文章标题" --description "文章摘要" --file ./article.md
vp run blog articles publish ARTICLE_ID
```

Agent 需要纯 JSON 输出时，可直接调用 `node apps/cli/bin/azn.mjs`。
SSH 环境的授权网页可在另一台电脑或手机打开；运行 CLI 的服务器无需浏览器或回调端口。
本次测试登录已注销，正式使用时需要发起新的设备授权。访问凭据有效期仍为 8 小时。

宿主机没有 Node 时，可复用已加载的生产镜像。以下命令在本次 ECS 上可用，正文通过 stdin 传入：

```bash
mkdir -p "$HOME/.config/azn"
chmod 700 "$HOME/.config/azn"
azn() {
  docker run --rm -i --pull never \
    --memory 128m --memory-swap 192m --cpus 0.5 --pids-limit 64 \
    -e AZN_CONFIG_DIR=/state \
    -v /srv/adrian-zephyr-notes/apps/cli:/cli:ro \
    -v "$HOME/.config/azn:/state" \
    adrian-zephyr-notes-server:fa1a1d622adf6be8c1ba86e2e877fd37c0561acb \
    node /cli/bin/azn.mjs "$@"
}
azn auth login --server https://zephyrai.site --no-browser
cat article.md | azn articles create --title "文章标题" --description "文章摘要" --file -
```

上述容器只挂载 CLI 和凭据目录，文件正文使用管道传入。更多字段和错误处理见
[CLI 使用说明](../apps/cli/README.md)。

## 验证范围

`vp check`、348 项单元/组件/命令行测试及该版本的
[GitHub CI](https://github.com/Adrian-Zephyr-Liao/adrian-zephyr-notes/actions/runs/42232679300)
均通过。生产证据已由另一位代理独立复核，文章身份、正文哈希、公开状态、权限拒绝、审计和撤销记录一致。

本次验证覆盖真实 SSH 设备授权和文章操作链路。浏览器确认复用了已有管理员会话；
首次 GitHub 账号登录、8 小时自然过期及长期并发负载不在本次生产操作范围内。
