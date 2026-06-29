import {
  Archive,
  BarChart3,
  BookOpenText,
  Boxes,
  CircleGauge,
  Dice5,
  Gamepad2,
  Home,
  Lightbulb,
  Link2,
  MessageCircle,
  Music2,
  Plane,
  Radio,
  Send,
  Sparkles,
  Tags,
  UserRound,
} from "lucide-react";

import type { NavGroup, PortalLink } from "./types";

const portalLinks: PortalLink[] = [
  {
    href: "/",
    label: "Adrian 的主页",
    description: "个人主页与索引",
    icon: Home,
    tone: "from-cyan-400/80 to-emerald-300/80",
  },
  {
    href: "/archives",
    label: "博客归档",
    description: "所有文章总览",
    icon: Archive,
    tone: "from-violet-400/80 to-sky-300/80",
  },
  {
    href: "/status",
    label: "站点状态",
    description: "服务与构建状态",
    icon: CircleGauge,
    tone: "from-amber-300/90 to-orange-400/80",
  },
  {
    href: "/lab",
    label: "灵感实验室",
    description: "实验性页面合集",
    icon: Sparkles,
    tone: "from-fuchsia-400/80 to-rose-300/80",
  },
];

const navGroups: NavGroup[] = [
  {
    label: "文章",
    items: [
      { href: "/archives", label: "总览", icon: Archive },
      { href: "/categories", label: "分类", icon: Boxes },
      { href: "/tags", label: "标签", icon: Tags },
      { href: "/charts", label: "文章统计", icon: BarChart3 },
    ],
  },
  {
    label: "友链",
    items: [
      { href: "/links", label: "友人帐", icon: Link2 },
      { href: "/friends", label: "朋友圈", icon: MessageCircle },
      { href: "/comments", label: "留言板", icon: Send },
    ],
  },
  {
    label: "好玩的",
    items: [
      { href: "/music", label: "音乐馆", icon: Music2 },
      { href: "/playground", label: "小玩具", icon: Gamepad2 },
    ],
  },
  {
    label: "虫洞",
    items: [
      { href: "https://travellings.cn/go.html", label: "开往", icon: Plane, external: true },
      { href: "https://storeweb.cn", label: "个站商店", icon: Radio, external: true },
    ],
  },
  {
    label: "我的",
    items: [
      { href: "/notes", label: "闲言碎语", icon: Lightbulb },
      { href: "/reading", label: "阅读记录", icon: BookOpenText },
      { href: "/uses", label: "装备", icon: Dice5 },
    ],
  },
  {
    label: "关于",
    items: [
      { href: "/about", label: "我", icon: UserRound },
      { href: "/log", label: "网站日志", icon: BarChart3 },
    ],
  },
];

const primaryNavGroups = navGroups.slice(0, 2);
const secondaryNavGroups = navGroups.slice(2);

export { navGroups, portalLinks, primaryNavGroups, secondaryNavGroups };
