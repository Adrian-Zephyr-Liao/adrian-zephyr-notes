import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { Loader2, LogOut } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "../ui/button";

function AdminAccount({
  admin,
  buttonRef,
  onLogout,
  pending,
  showIdentity = true,
}: {
  admin: AdminUserResponse;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onLogout: (button: HTMLButtonElement) => void;
  pending: boolean;
  showIdentity?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {showIdentity ? (
        <>
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-xs font-semibold text-primary"
            aria-hidden="true"
          >
            {(admin.name ?? admin.login).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{admin.name ?? admin.login}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">@{admin.login}</p>
          </div>
        </>
      ) : null}
      <Button
        ref={buttonRef}
        aria-busy={pending}
        aria-disabled={pending}
        aria-label={pending ? "正在退出登录" : "退出登录"}
        className={pending ? "cursor-wait opacity-50" : undefined}
        title={pending ? "正在退出登录" : `退出 @${admin.login}`}
        size="icon"
        type="button"
        variant="ghost"
        onClick={(event) => {
          if (!pending) onLogout(event.currentTarget);
        }}
      >
        {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <LogOut />}
      </Button>
    </div>
  );
}
export { AdminAccount };
