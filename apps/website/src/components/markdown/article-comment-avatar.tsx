import type { ArticleCommentAuthor, AuthUserResponse } from "@adrian-zephyr-notes/contracts";

type AvatarUser = ArticleCommentAuthor | AuthUserResponse;

function AuthorAvatar({ user, size = "md" }: { user: AvatarUser; size?: "sm" | "md" }) {
  const label = user.name ?? user.login;
  const initial = label.slice(0, 1).toUpperCase();
  const sizeClassName = size === "sm" ? "size-7 text-xs" : "size-9 text-sm";

  return (
    <span
      aria-hidden="true"
      className={`${sizeClassName} grid shrink-0 place-items-center rounded-full border border-(--glass-border) bg-primary/10 bg-cover bg-center font-black text-primary`}
      style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
      title={label}
    >
      {user.avatarUrl ? null : initial}
    </span>
  );
}

export { AuthorAvatar };
