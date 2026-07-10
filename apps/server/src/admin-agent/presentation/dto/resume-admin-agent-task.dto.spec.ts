import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { ResumeAdminAgentTaskDto } from "./resume-admin-agent-task.dto";

describe("ResumeAdminAgentTaskDto", () => {
  it("accepts a structured resume payload", async () => {
    const dto = new ResumeAdminAgentTaskDto();

    dto.resume = {
      decision: "approve",
    };

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejects empty resume payloads", async () => {
    const dto = new ResumeAdminAgentTaskDto();

    dto.resume = {};

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it("rejects non-object resume payloads", async () => {
    const dto = new ResumeAdminAgentTaskDto();

    dto.resume = [] as never;

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
