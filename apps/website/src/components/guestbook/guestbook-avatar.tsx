import type { AuthUserResponse, GuestbookMessageAuthor } from "@adrian-zephyr-notes/contracts";
import { UserRound } from "lucide-react";

function AuthorAvatar({ author }: { author: GuestbookMessageAuthor }) {
  if (author.type === "GITHUB") {
    return <UserAvatar user={author} />;
  }

  return <GuestAvatar seed={author.avatarSeed || author.nickname} />;
}

function UserAvatar({ user }: { user: Pick<AuthUserResponse, "avatarUrl" | "login" | "name"> }) {
  const label = user.name ?? user.login;
  const initial = label.slice(0, 1).toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full border border-(--glass-border) bg-primary/10 bg-cover bg-center text-sm font-black text-primary"
      style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
      title={label}
    >
      {user.avatarUrl ? null : initial}
    </span>
  );
}

function GuestAvatar({ seed }: { seed: string }) {
  const hue = createHue(seed);

  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full border border-(--glass-border) font-black text-white"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 72% 52%), hsl(${(hue + 54) % 360} 74% 46%))`,
      }}
    >
      <UserRound className="size-5" />
    </span>
  );
}

function AuthorName({ author }: { author: GuestbookMessageAuthor }) {
  const name = getAuthorName(author);

  if (author.type === "GITHUB") {
    return (
      <a
        href={author.profileUrl}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 truncate text-sm font-black text-foreground hover:text-primary"
      >
        {name}
      </a>
    );
  }

  return <span className="min-w-0 truncate text-sm font-black text-foreground">{name}</span>;
}

function getAuthorName(author: GuestbookMessageAuthor) {
  return author.type === "GITHUB" ? (author.name ?? author.login) : author.nickname;
}

function createHue(value: string) {
  let hash = 0;

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }

  return hash;
}

export { AuthorAvatar, AuthorName, GuestAvatar, UserAvatar, getAuthorName };
