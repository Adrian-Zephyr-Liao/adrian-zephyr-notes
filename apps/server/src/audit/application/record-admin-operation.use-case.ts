import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_OPERATION_LOG_REPOSITORY,
  type AdminOperationLogRepository,
  type RecordAdminOperationInput,
} from "../domain/admin-operation-log.repository";

@Injectable()
class RecordAdminOperationUseCase {
  constructor(
    @Inject(ADMIN_OPERATION_LOG_REPOSITORY)
    private readonly adminOperationLogRepository: AdminOperationLogRepository,
  ) {}

  execute(input: RecordAdminOperationInput) {
    return this.adminOperationLogRepository.record({
      ...input,
      metadata: input.metadata ?? null,
      requestContext: {
        ipAddress: normalizeOptionalText(input.requestContext?.ipAddress),
        userAgent: normalizeOptionalText(input.requestContext?.userAgent),
      },
      resourceId: normalizeOptionalText(input.resourceId),
      resourceType: requireText(input.resourceType, "Resource type"),
      summary: requireText(input.summary, "Summary"),
    });
  }
}

function requireText(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export { RecordAdminOperationUseCase };
