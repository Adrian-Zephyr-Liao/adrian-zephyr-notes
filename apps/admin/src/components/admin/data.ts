import {
  Gauge,
  Sparkles,
  NotebookPen,
  MessageCircle,
  BookOpenText,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type { AdminSectionKey, AdminShellProps, AdminNavGroup } from "./types";

export const adminSectionMeta: Record<AdminSectionKey, { description: string; title: string }> = {
  assistant: {
    description: "查询记录，核对结果，单独确认评论操作。",
    title: "把问题，交给编辑助手。",
  },
  articles: {
    description: "管理文章、分类、标签与发布进度。",
    title: "文章工作台",
  },
  audit: {
    description: "追踪后台写操作与治理记录。",
    title: "每一次改动，都有迹可循。",
  },
  comments: {
    description: "结合文章和回复上下文处理评论。",
    title: "读者来信",
  },
  guestbook: {
    description: "管理留言可见性、置顶和软删除。",
    title: "读者来信",
  },
  overview: {
    description: "聚合内容进度、互动治理和系统动态。",
    title: "运营工作台",
  },
  site: {
    description: "维护首页、导航、公告和社交链接。",
    title: "让站点，像你自己。",
  },
};

export const articlePageMeta = {
  categories: {
    description: "维护文章分类及其用途说明。",
    title: "分类管理",
  },
  list: {
    description: "检索、筛选并维护全部文章。",
    title: "文章列表",
  },
  tags: {
    description: "规范标签并合并重复条目。",
    title: "标签管理",
  },
} satisfies Record<
  NonNullable<AdminShellProps["articlePage"]>,
  { description: string; title: string }
>;

export function createAdminNavGroups(assistantEnabled: boolean): AdminNavGroup[] {
  return [
    {
      label: "总览",
      items: [
        {
          icon: Gauge,
          key: "overview",
          label: "运营工作台",
          to: "/",
        },
        ...(assistantEnabled
          ? [
              {
                icon: Sparkles,
                key: "assistant" as const,
                label: "管理助手",
                to: "/assistant" as const,
              },
            ]
          : []),
      ],
    },
    {
      label: "创作",
      items: [
        {
          icon: NotebookPen,
          key: "articles",
          label: "文章",
          to: "/articles",
        },
      ],
    },
    {
      label: "互动",
      items: [
        {
          icon: MessageCircle,
          key: "comments",
          label: "评论",
          to: "/comments",
        },
        {
          icon: BookOpenText,
          key: "guestbook",
          label: "留言板",
          to: "/guestbook",
        },
      ],
    },
    {
      label: "系统",
      items: [
        {
          icon: Settings2,
          key: "site",
          label: "站点配置",
          to: "/site",
        },
        {
          icon: ShieldCheck,
          key: "audit",
          label: "审计日志",
          to: "/audit",
        },
      ],
    },
  ];
}
