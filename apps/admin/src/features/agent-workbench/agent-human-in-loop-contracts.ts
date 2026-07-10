import { z } from "zod";
import type { AdminAgentTaskName } from "@adrian-zephyr-notes/contracts";

const adminAgentId = "admin-agent";
const askUserQuestionToolName = "ask_user_question";
const controlAdminAgentTaskToolName = "control_admin_agent_task";
const startAdminAgentTaskToolName = "start_admin_agent_task";

const agentTaskResumeChoiceOperationSchema = z.object({
  resume: z
    .record(z.string(), z.unknown())
    .describe("提交给 Agent 确认点的结构化授权参数。具体字段由对应业务处理解释。"),
  taskId: z
    .string()
    .min(1)
    .describe("要继续处理的业务处理 ID。必须来自工具返回或 workspace.businessTaskContext。"),
  summary: z.string().optional().describe("给管理员看的业务操作摘要。"),
  type: z.literal("agent_task_resume").describe("继续一次需要管理员确认的 Agent 业务处理。"),
});

const askUserChoiceOperationSchema = agentTaskResumeChoiceOperationSchema;

const askUserQuestionSchema = z.object({
  choices: z
    .array(
      z.object({
        description: z.string().optional().describe("这个选项的影响或适用场景。"),
        id: z
          .string()
          .min(1)
          .max(40)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .describe("稳定选项 ID，只能使用字母、数字、下划线或短横线。"),
        label: z.string().min(1).max(48).describe("展示给管理员的选项文本。"),
        operations: z
          .array(agentTaskResumeChoiceOperationSchema)
          .max(4)
          .optional()
          .describe(
            "如果这个选项本身就是对 Agent 确认点的授权，把 agent_task_resume 操作放在这里。管理员点击该选项即表示确认继续执行该业务操作。",
          ),
      }),
    )
    .min(2)
    .max(4)
    .describe("提供给管理员选择的互斥选项。"),
  context: z.string().max(600).optional().describe("为什么需要管理员选择。"),
  question: z.string().min(1).max(240).describe("要问管理员的问题。"),
});

const startAdminAgentTaskSchema = z.object({
  input: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("启动 Agent 业务处理时传入的结构化上下文。只传业务参数，不传 UI 状态。"),
  reason: z.string().max(240).optional().describe("为什么需要启动这个 Agent 业务处理。"),
  taskName: z
    .string()
    .min(1)
    .describe(
      "要启动的已注册 Agent 业务处理。必须从 workspace.businessTaskContext.availableBusinessTasks 的 taskName 中选择，不得编造。",
    ),
});

const controlAdminAgentTaskSchema = z.object({
  action: z
    .string()
    .min(1)
    .describe(
      "对已有 Agent 业务处理执行的控制动作。必须从 workspace.businessTaskContext.availableBusinessTasks.actions 的 action 中选择，不得编造。",
    ),
  reason: z.string().max(240).optional().describe("为什么需要执行这个控制动作。"),
  taskId: z
    .string()
    .min(1)
    .describe("要控制的业务处理 ID。必须来自 workspace.businessTaskContext，不得编造。"),
});

type AskUserQuestionArgs = z.infer<typeof askUserQuestionSchema>;
type AskUserChoiceOperation = z.infer<typeof askUserChoiceOperationSchema>;
type ControlAdminAgentTaskArgs = z.infer<typeof controlAdminAgentTaskSchema>;
type StartAdminAgentTaskArgs = z.infer<typeof startAdminAgentTaskSchema>;
type AgentTaskResumeChoiceOperation = z.infer<typeof agentTaskResumeChoiceOperationSchema>;

export {
  adminAgentId,
  agentTaskResumeChoiceOperationSchema,
  askUserQuestionSchema,
  askUserQuestionToolName,
  controlAdminAgentTaskSchema,
  controlAdminAgentTaskToolName,
  startAdminAgentTaskSchema,
  startAdminAgentTaskToolName,
};
export type {
  AdminAgentTaskName,
  AskUserQuestionArgs,
  AskUserChoiceOperation,
  AgentTaskResumeChoiceOperation,
  ControlAdminAgentTaskArgs,
  StartAdminAgentTaskArgs,
};
