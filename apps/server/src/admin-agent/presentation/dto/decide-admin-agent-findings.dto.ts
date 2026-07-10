import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsUUID, ValidateNested } from "class-validator";
import type { DecideAdminAgentFindingsRequest } from "@adrian-zephyr-notes/contracts";

type DecideAdminAgentFindingItemRequest = DecideAdminAgentFindingsRequest["decisions"][number];

class DecideAdminAgentFindingItemDto implements DecideAdminAgentFindingItemRequest {
  @IsIn(["EXECUTE_PROPOSED_ACTION", "REJECT", "RESTORE_COMMENT"])
  decision!: "EXECUTE_PROPOSED_ACTION" | "REJECT" | "RESTORE_COMMENT";

  @IsUUID()
  findingId!: string;
}

class DecideAdminAgentFindingsDto implements DecideAdminAgentFindingsRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DecideAdminAgentFindingItemDto)
  decisions!: DecideAdminAgentFindingItemDto[];
}

export { DecideAdminAgentFindingsDto };
