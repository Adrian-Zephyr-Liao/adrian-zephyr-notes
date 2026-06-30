const markdownSyntaxShowcasePost = {
  slug: "5f7448b7",
  title: "Markdown 语法全量展示",
  description:
    "用一篇完整示例验证博客 Markdown 渲染能力：标题、段落、强调、列表、表格、代码、图片、引用、脚注和 GFM 扩展。",
  category: "笔记",
  tags: ["Markdown", "GFM", "Syntax"],
  createdAt: "2024-05-25",
  updatedAt: "2026-06-30",
  wordCount: 4680,
  readingMinutes: 16,
  author: {
    name: "Adrian",
    description: "Notes, essays, and experiments.",
  },
  markdown: `
> 注：这一页用于打磨 2C 博客的 Markdown 阅读体验。内容结构参考常见主题文章页，渲染链路使用 React Markdown、remark-gfm、rehype-slug 和 rehype-pretty-code。

## Markdown 基础块级语法

Markdown 最核心的体验是让正文、标题、列表和引用在纯文本里保持可读。下面先展示标题、段落、换行、分隔线和转义字符。

# 一级标题 H1

## 二级标题 H2

### 三级标题 H3

#### 四级标题 H4

##### 五级标题 H5

###### 六级标题 H6

这是一个普通段落。段落里可以写中文、English words、数字 123，以及内联标记。单个换行会被视作同一段落的一部分。

第一行使用反斜杠硬换行\\
第二行会另起一行。

---

也可以使用反斜杠转义 Markdown 控制字符：\\*这不是斜体\\*，\\[这不是链接\\](https://example.com)，\\# 这不是标题。

### 分隔线

下面三种写法都会生成 thematic break：

---

***

___

## 强调、链接和图片

内联语义需要在正文里足够清楚：**粗体**、*斜体*、***粗斜体***、~~删除线~~、\`inline code\` 都应该能被快速识别。

普通链接会保持可访问的焦点态，例如 [Next.js](https://nextjs.org "Next.js 官网")。自动链接可以直接写成 <https://github.com>，GFM 也会识别裸 URL：https://viteplus.dev。

引用式链接适合长文复用：[React Markdown][react-markdown]、[remark-gfm][remark-gfm]。

图片语法应该有稳定边界、标题和圆角：

![站点图片示例：globe.svg](/globe.svg "Markdown 图片标题")

引用式图片也应该能正常渲染：

![窗口图标][window-icon]

## 列表语法

无序列表支持 \`-\`、\`+\`、\`*\` 三种项目符号，嵌套层级要有清晰缩进。

- 一级项目 A
  - 二级项目 A.1
    - 三级项目 A.1.a
- 一级项目 B

+ 使用加号的项目
+ 另一个加号项目

* 使用星号的项目
* 另一个星号项目

有序列表支持任意起始编号，浏览器会按 Markdown 语义继续编号：

3. 第三个步骤
4. 第四个步骤
   1. 子步骤一
   2. 子步骤二
5. 第五个步骤

GFM 任务列表用于展示待办状态：

- [x] 支持 CommonMark 基础语法
- [x] 支持 GFM 表格、任务列表、脚注、删除线
- [x] 支持代码高亮和标题
- [ ] 后续接入真实 CMS 内容源

## 引用语法

> 一级引用可以用来放摘要、提示或摘录。
>
> - 引用里也能包含列表
> - 也能包含 **强调** 和 \`inline code\`
>
> > 嵌套引用用于表达上下文层级，但视觉上不能压过正文。

## 表格语法

GFM 表格需要支持左对齐、右对齐、居中对齐、内联代码和长文本换行。

| 语法 | 类型 | 状态 | 说明 |
| :--- | ---: | :---: | --- |
| \`**bold**\` | inline | ✅ | 粗体文本 |
| \`[link](url)\` | inline | ✅ | 链接文本 |
| \`![alt](src)\` | inline | ✅ | 图片资源 |
| \`code fence\` | block | ✅ | 围栏代码块 |
| \`[^note]\` | block | ✅ | GFM 脚注 |

## 代码语法

行内代码适合短变量，例如 \`const slug = "5f7448b7"\`。块级代码需要区分普通代码、带语言代码、带标题代码和缩进代码。

普通围栏代码：

\`\`\`
pnpm install
vp check
vp test
\`\`\`

带语言和标题的代码块：

\`\`\`tsx title="markdown-renderer.tsx"
import { MarkdownAsync } from "react-markdown";
import remarkGfm from "remark-gfm";

export async function MarkdownRenderer({ content }: { content: string }) {
  return (
    <MarkdownAsync remarkPlugins={[remarkGfm]} skipHtml>
      {content}
    </MarkdownAsync>
  );
}
\`\`\`

缩进代码块：

    pnpm --filter @adrian-zephyr-notes/website build
    open http://localhost:3002/posts/5f7448b7

JSON 示例：

\`\`\`json title="post-meta.json"
{
  "slug": "5f7448b7",
  "title": "Markdown 语法全量展示",
  "tags": ["Markdown", "GFM", "Syntax"]
}
\`\`\`

代码块里的 Markdown 标题只应该作为代码展示，不应该进入右侧目录：

\`\`\`md title="not-toc.md"
## 这不是目录项

这段内容位于代码块里。
\`\`\`

## Front-matter 示例

\`Front-matter\` 不是 Markdown 标准语法本身，但博客系统常用它保存页面元数据。这里把它作为 fenced code 展示，避免被当成文章分隔线。

### Page Front-matter

\`\`\`yaml title="page-front-matter.yml"
---
title: 页面标题
date: 2024-05-25 17:04:00
updated: 2026-06-30 08:30:00
type: tags
comments: true
aside: true
top_img: /images/page-cover.png
highlight_shrink: false
---
\`\`\`

### Post Front-matter

\`\`\`yaml title="post-front-matter.yml"
---
title: Markdown 语法全量展示
date: 2024-05-25 17:04:00
updated: 2026-06-30 08:30:00
tags:
  - MarkDown
  - Front-matter
categories:
  - 笔记
keywords:
  - hexo
  - markdown
description: 认识 Markdown 文件顶部的 Front-matter 配置区域
top_img: /images/front-matter-cover.png
cover: /images/front-matter-card.png
comments: true
toc: true
toc_number: true
copyright: true
highlight_shrink: false
---
\`\`\`

## 原始 HTML 和安全策略

本项目的渲染器启用了 \`skipHtml\`，所以 Markdown 里的原始 HTML 会被跳过。这能减少文章内容注入不可信 HTML 的风险。

下面这段输入会被当作不渲染的 HTML，真实博客内容应优先使用 Markdown 语法表达：

\`\`\`md title="raw-html.md"
<mark>这段 HTML 在当前渲染器中不会输出。</mark>
<script>alert("blocked")</script>
\`\`\`

<mark>这段 HTML 在当前渲染器中不会输出。</mark>

## 脚注、定义和补充信息

脚注适合放补充说明，不打断正文阅读。这里引用第一个脚注[^frontmatter]，再引用第二个脚注[^gfm]。

链接定义和图片定义放在文末，不会直接显示，但会被前面的引用式链接和图片消费。

## Front-matter 字段速查

### Page 字段

| 写法 | 解释 |
| --- | --- |
| \`title\` | 【必需】页面标题 |
| \`date\` | 【必需】页面创建日期 |
| \`type\` | 【必需】标签、分类、关于、友情链接等页面需要配置 |
| \`updated\` | 【可选】页面更新日期 |
| \`description\` | 【可选】页面描述 |
| \`keywords\` | 【可选】页面关键词 |
| \`comments\` | 【可选】显示页面评论模块 |
| \`top_img\` | 【可选】页面顶部图片 |
| \`aside\` | 【可选】显示侧边栏 |
| \`highlight_shrink\` | 【可选】配置代码框是否展开 |

### Post 字段

| 写法 | 解释 |
| --- | --- |
| \`title\` | 【必需】文章标题 |
| \`date\` | 【必需】文章创建日期 |
| \`updated\` | 【可选】文章更新日期 |
| \`tags\` | 【可选】文章标签 |
| \`categories\` | 【可选】文章分类 |
| \`keywords\` | 【可选】文章关键词 |
| \`description\` | 【可选】文章摘要和 SEO 描述 |
| \`top_img\` | 【可选】文章顶部图片 |
| \`cover\` | 【可选】文章缩略图 |
| \`comments\` | 【可选】显示文章评论模块 |
| \`toc\` | 【可选】显示文章目录 |
| \`toc_number\` | 【可选】显示目录序号 |
| \`copyright\` | 【可选】显示版权模块 |
| \`copyright_author\` | 【可选】版权模块的文章作者 |
| \`copyright_author_href\` | 【可选】版权模块的作者链接 |
| \`copyright_url\` | 【可选】版权模块的文章链接 |
| \`copyright_info\` | 【可选】版权声明文字 |
| \`highlight_shrink\` | 【可选】配置代码框是否展开 |

## 博客扩展字段示例

从很多 Hexo 主题开始，文章置顶可以直接在 \`Front-matter\` 区域里添加 \`sticky\` 属性。数值越大，置顶优先级越高：

\`\`\`yaml title="sticky.yml"
---
title: 重要公告
sticky: 100
---
\`\`\`

对于具有首页轮播和推荐卡片的主题，通常会额外提供排序字段：

- \`swiper_index\`：首页轮播图配置，数字越小越靠前
- \`top_group_index\`：首页右侧卡片组配置，数字越小越靠前
- \`top_single_background\`：部分页面的顶部背景图

> 只需要在文章顶部配置 \`swiper_index\` 和 \`top_group_index\`，即可让文章进入更靠前的展示区域。

> 好的博客阅读体验不是堆满特效，而是在长文里稳定地提供节奏、层次、定位和可复制的内容结构。

[^frontmatter]: Front-matter 不属于 Markdown 标准语法本身，但很多静态站点生成器都会解析它作为页面元数据。
[^gfm]: GFM 指 GitHub Flavored Markdown，常见扩展包括表格、任务列表、删除线、自动链接和脚注。

[react-markdown]: https://github.com/remarkjs/react-markdown
[remark-gfm]: https://github.com/remarkjs/remark-gfm
[window-icon]: /window.svg
`,
};

export { markdownSyntaxShowcasePost };
