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
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="truncate text-sm font-medium">{admin.name ?? admin.login}</p>
          <p className="truncate text-xs text-muted-foreground">@{admin.login}</p>
        </div>
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
