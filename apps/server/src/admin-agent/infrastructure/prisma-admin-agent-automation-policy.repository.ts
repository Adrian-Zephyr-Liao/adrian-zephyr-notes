import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { SITE_SETTING_KEYS } from "../../site-config/domain/site-setting-keys";
import {
  normalizeAdminAgentAutomationPolicy,
  type AdminAgentAutomationPolicyInput,
} from "../domain/admin-agent-automation-policy";
import type { AdminAgentAutomationPolicyRepository } from "../domain/admin-agent-automation-policy.repository";

@Injectable()
class PrismaAdminAgentAutomationPolicyRepository implements AdminAgentAutomationPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicy() {
    const record = await this.prisma.siteSetting.findUnique({
      where: { key: SITE_SETTING_KEYS.adminAgentAutomationPolicy },
    });

    return normalizeAdminAgentAutomationPolicy(toPolicyInput(record?.value));
  }
}

function toPolicyInput(value: Prisma.JsonValue | undefined): AdminAgentAutomationPolicyInput {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AdminAgentAutomationPolicyInput)
    : null;
}

export { PrismaAdminAgentAutomationPolicyRepository };
