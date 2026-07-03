import { IsIn } from "class-validator";
import type { UpdateAdminArticleCommentRequest } from "@adrian-zephyr-notes/contracts";

class UpdateAdminArticleCommentDto implements UpdateAdminArticleCommentRequest {
  @IsIn(["HIDDEN", "VISIBLE"])
  status!: UpdateAdminArticleCommentRequest["status"];
}

export { UpdateAdminArticleCommentDto };
