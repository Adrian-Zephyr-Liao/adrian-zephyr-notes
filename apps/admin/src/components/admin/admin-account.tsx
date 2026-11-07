import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { LogOut } from "lucide-react";
import { logoutAdmin } from "../../lib/admin-api";
import { Button } from "../ui/button";

function AdminAccount({
  admin,
  onLogout,
  showIdentity = true,
}: {
  admin: AdminUserResponse;
  onLogout: () => void;
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
        aria-label="退出登录"
        title={`退出 @${admin.login}`}
        size="icon"
        type="button"
        variant="ghost"
        onClick={() => {
          void logoutAdmin().finally(onLogout);
        }}
      >
        <LogOut />
      </Button>
    </div>
  );
}
export { AdminAccount };
