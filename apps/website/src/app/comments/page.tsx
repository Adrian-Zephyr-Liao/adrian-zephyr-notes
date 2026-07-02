import type { Metadata } from "next";

import { GuestbookBoard } from "@/components/guestbook/guestbook-board";

export const metadata: Metadata = {
  title: "留言板 | Adrian Zephyr Notes",
  description: "给 Adrian Zephyr Notes 留下一条公开留言。",
};

export default function CommentsPage() {
  return <GuestbookBoard />;
}
