import type { ModerateAdminAgentCommentAnalysisRequest } from "@adrian-zephyr-notes/contracts";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";

class ModerateAdminAgentCommentAnalysisDto implements ModerateAdminAgentCommentAnalysisRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  findingIds!: string[];
}

export { ModerateAdminAgentCommentAnalysisDto };
