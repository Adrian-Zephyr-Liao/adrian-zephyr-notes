import { IsBoolean, IsIn, IsOptional } from "class-validator";
import type { UpdateAdminGuestbookMessageRequest } from "@adrian-zephyr-notes/contracts";

class UpdateAdminGuestbookMessageDto implements UpdateAdminGuestbookMessageRequest {
  @IsOptional()
  @IsIn(["DELETED", "HIDDEN", "VISIBLE"])
  status?: UpdateAdminGuestbookMessageRequest["status"];

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export { UpdateAdminGuestbookMessageDto };
