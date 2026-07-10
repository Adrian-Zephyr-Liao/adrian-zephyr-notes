import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_OPERATION_LOG_REPOSITORY,
  type AdminOperationLogRepository,
  type RecordAdminOperationInput,
} from "../domain/admin-operation-log.repository";
import { createAdminOperationSummary } from "../domain/admin-operation-summary";

type RecordAdminOperationCommand = Omit<RecordAdminOperationInput, "summary">;

@Injectable()
class RecordAdminOperationUseCase {
  constructor(
    @Inject(ADMIN_OPERATION_LOG_REPOSITORY)
    private readonly adminOperationLogRepository: AdminOperationLogRepository,
  ) {}

  execute(input: RecordAdminOperationCommand) {
    const metadata = input.metadata ?? null;
    const resourceId = normalizeOptionalText(input.resourceId);
    const resourceType = requireText(input.resourceType, "Resource type");

    return this.adminOperationLogRepository.record({
      ...input,
      metadata,
      requestContext: {
        ipAddress: normalizeOptionalText(input.requestContext?.ipAddress),
        userAgent: normalizeOptionalText(input.requestContext?.userAgent),
      },
      resourceId,
      resourceType,
      summary: createAdminOperationSummary({
        action: input.action,
        metadata,
        resourceId,
        resourceType,
      }),
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
