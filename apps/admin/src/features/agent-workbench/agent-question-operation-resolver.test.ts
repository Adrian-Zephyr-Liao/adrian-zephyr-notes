import { describe, expect, it } from "vitest";
import { resolveChoiceOperations } from "./agent-question-operation-resolver";

describe("agent question operation resolver", () => {
  it("keeps only backend task resume operations from question choices", () => {
    expect(
      resolveChoiceOperations({
        description: "屏蔽风险建议",
        id: "handle_all",
        label: "全部处理",
        operations: [
          {
            action: "hide",
            findingIds: ["hide-1"],
            type: "comment_moderation",
          } as never,
          {
            resume: {
              decision: "APPROVE",
              findingIds: ["finding-1"],
            },
            taskId: "run-1",
            type: "agent_task_resume",
          },
        ],
      }),
    ).toEqual([
      {
        resume: {
          decision: "APPROVE",
          findingIds: ["finding-1"],
        },
        taskId: "run-1",
        type: "agent_task_resume",
      },
    ]);
  });

  it("drops malformed backend task resume operations", () => {
    expect(
      resolveChoiceOperations({
        description: "非法操作不会执行",
        id: "malformed",
        label: "非法操作",
        operations: [
          {
            taskId: "run-1",
            type: "agent_task_resume",
          } as never,
          {
            resume: {
              decision: "APPROVE",
            },
            type: "agent_task_resume",
          } as never,
        ],
      }),
    ).toEqual([]);
  });
});
