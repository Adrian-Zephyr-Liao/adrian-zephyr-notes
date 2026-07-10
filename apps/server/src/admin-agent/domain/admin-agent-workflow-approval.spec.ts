import { describe, expect, it } from "vitest";
import {
  authorizeGenericApprovalResume,
  createCommentModerationApprovalInterruption,
  createGenericApprovalInterruption,
  isAdminAgentWorkflowApprovalSubject,
  isGenericApprovalApproved,
  shouldRequestGenericApproval,
  toBusinessApprovalOutput,
  toCommentModerationApprovalInterruptionFromGraphResult,
  toCommentModerationApprovalResume,
  toGenericApprovalInterruptionFromGraphResult,
  toGenericApprovalResume,
  toStoredCommentModerationApprovalInterruption,
  toStoredGenericApprovalInterruption,
  withGenericApprovalSummary,
} from "./admin-agent-workflow-approval";

describe("admin agent workflow approval contract", () => {
  it("creates comment moderation approval questions with explicit resume payloads", () => {
    expect(
      createCommentModerationApprovalInterruption({
        findingIds: ["finding-1", "finding-2"],
        runId: "run-1",
        scope: "today",
      }),
    ).toMatchObject({
      action: "HIDE_COMMENT",
      approvalId: "comment-moderation:run-1",
      findingIds: ["finding-1", "finding-2"],
      kind: "COMMENT_MODERATION_APPROVAL",
      options: [
        {
          id: "approve_all_hide",
          resume: {
            decision: "APPROVE",
            findingIds: ["finding-1", "finding-2"],
          },
        },
        {
          id: "defer",
          resume: {
            decision: "DEFER",
            findingIds: ["finding-1", "finding-2"],
          },
        },
      ],
      question: "是否确认屏蔽 2 条评论？",
      scope: "today",
      subject: "ARTICLE_COMMENT",
    });
  });

  it("creates generic approval questions with explicit resume payloads", () => {
    expect(
      createGenericApprovalInterruption({
        action: "UPDATE_SITE_ANNOUNCEMENT",
        payload: {
          announcementId: "announcement-1",
        },
        question: "是否确认更新站点公告？",
        runId: "run-1",
        subject: "SITE_CONFIG",
        summary: "确认后会更新站点公告。",
      }),
    ).toMatchObject({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      approvalId: "update_site_announcement:run-1",
      kind: "ADMIN_AGENT_APPROVAL",
      options: [
        {
          id: "approve",
          resume: {
            action: "UPDATE_SITE_ANNOUNCEMENT",
            approvalId: "update_site_announcement:run-1",
            decision: "approve",
            payload: {
              announcementId: "announcement-1",
            },
            subject: "SITE_CONFIG",
          },
        },
        {
          id: "defer",
          resume: {
            action: "UPDATE_SITE_ANNOUNCEMENT",
            approvalId: "update_site_announcement:run-1",
            decision: "defer",
            payload: {
              announcementId: "announcement-1",
            },
            subject: "SITE_CONFIG",
          },
        },
      ],
      question: "是否确认更新站点公告？",
      subject: "SITE_CONFIG",
    });
  });

  it("parses comment moderation approval resume payloads", () => {
    expect(
      toCommentModerationApprovalResume({
        decision: "APPROVE",
        findingIds: ["finding-1", "finding-2"],
      }),
    ).toEqual({
      decision: "APPROVE",
      findingIds: ["finding-1", "finding-2"],
    });
  });

  it("parses comment moderation approval interruptions from graph and stored values", () => {
    const interruption = createCommentModerationApprovalInterruption({
      findingIds: ["finding-1"],
      runId: "run-1",
      scope: "recentVisibleFallback",
    });

    expect(
      toCommentModerationApprovalInterruptionFromGraphResult({
        __interrupt__: [{ value: interruption }],
      }),
    ).toEqual(interruption);
    expect(toStoredCommentModerationApprovalInterruption(interruption)).toEqual(interruption);
    expect(
      toCommentModerationApprovalInterruptionFromGraphResult({
        __interrupt__: [{ value: { ...interruption, findingIds: [42] } }],
      }),
    ).toBeNull();
  });

  it("parses generic approval interruptions from graph and stored values", () => {
    const interruption = createGenericApprovalInterruption({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      payload: { announcement: "hello" },
      question: "是否更新？",
      runId: "run-1",
      subject: "SITE_CONFIG",
      summary: "等待更新确认。",
    });

    expect(
      toGenericApprovalInterruptionFromGraphResult({
        __interrupt__: [{ value: interruption }],
      }),
    ).toEqual(interruption);
    expect(toStoredGenericApprovalInterruption(interruption)).toEqual(interruption);
    expect(
      toGenericApprovalInterruptionFromGraphResult({
        __interrupt__: [{ value: { ...interruption, subject: "UNKNOWN" } }],
      }),
    ).toBeNull();
  });

  it("rejects malformed comment moderation approval resume payloads", () => {
    expect(() =>
      toCommentModerationApprovalResume({
        decision: "APPROVE",
        findingIds: ["finding-1", 42],
      }),
    ).toThrow("Comment moderation resume payload requires string findingIds.");
    expect(() =>
      toCommentModerationApprovalResume({
        decision: "NOPE",
        findingIds: ["finding-1"],
      }),
    ).toThrow("Comment moderation resume payload requires APPROVE or DEFER decision.");
  });

  it("parses generic approval resume payloads with normalized optional fields", () => {
    expect(
      toGenericApprovalResume({
        action: " UPDATE_SITE_ANNOUNCEMENT ",
        approvalId: " approval-1 ",
        decision: " approve ",
        payload: {
          title: "公告",
        },
        subject: "SITE_CONFIG",
      }),
    ).toEqual({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      approvalId: "approval-1",
      decision: "approve",
      payload: {
        title: "公告",
      },
      subject: "SITE_CONFIG",
    });
  });

  it("authorizes generic approval resumes against the current interruption", () => {
    const interruption = createGenericApprovalInterruption({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      payload: {
        announcementId: "canonical-announcement",
      },
      question: "是否确认更新站点公告？",
      runId: "run-1",
      subject: "SITE_CONFIG",
      summary: "确认后会更新站点公告。",
    });

    expect(
      authorizeGenericApprovalResume(
        {
          action: "UPDATE_SITE_ANNOUNCEMENT",
          approvalId: "update_site_announcement:run-1",
          decision: "approve",
          payload: {
            announcementId: "tampered-announcement",
          },
          subject: "SITE_CONFIG",
        },
        interruption,
      ),
    ).toEqual({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      approvalId: "update_site_announcement:run-1",
      decision: "approve",
      payload: {
        announcementId: "canonical-announcement",
      },
      subject: "SITE_CONFIG",
    });
  });

  it("rejects generic approval resumes that do not match the current interruption", () => {
    const interruption = createGenericApprovalInterruption({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      payload: {
        announcementId: "announcement-1",
      },
      question: "是否确认更新站点公告？",
      runId: "run-1",
      subject: "SITE_CONFIG",
      summary: "确认后会更新站点公告。",
    });

    expect(() =>
      authorizeGenericApprovalResume(
        {
          action: "UPDATE_SITE_ANNOUNCEMENT",
          approvalId: "different-approval",
          decision: "approve",
          subject: "SITE_CONFIG",
        },
        interruption,
      ),
    ).toThrow("approvalId does not match");

    expect(() =>
      authorizeGenericApprovalResume(
        {
          action: "DELETE_SITE_ANNOUNCEMENT",
          approvalId: "update_site_announcement:run-1",
          decision: "approve",
          subject: "SITE_CONFIG",
        },
        interruption,
      ),
    ).toThrow("action does not match");

    expect(() =>
      authorizeGenericApprovalResume(
        {
          action: "UPDATE_SITE_ANNOUNCEMENT",
          approvalId: "update_site_announcement:run-1",
          decision: "approve",
          subject: "ARTICLE",
        },
        interruption,
      ),
    ).toThrow("subject does not match");
  });

  it("keeps approval gating rules explicit", () => {
    expect(shouldRequestGenericApproval({ requiresApproval: true })).toBe(true);
    expect(shouldRequestGenericApproval({ requireApproval: true })).toBe(true);
    expect(shouldRequestGenericApproval({ approvalMode: "required" })).toBe(true);
    expect(shouldRequestGenericApproval({ approvalMode: "optional" })).toBe(false);
  });

  it("recognizes generic approval decisions and subjects", () => {
    expect(isGenericApprovalApproved({ decision: "approve" })).toBe(true);
    expect(isGenericApprovalApproved({ decision: "APPROVE" })).toBe(true);
    expect(isGenericApprovalApproved({ decision: "defer" })).toBe(false);
    expect(isAdminAgentWorkflowApprovalSubject("ARTICLE_COMMENT")).toBe(true);
    expect(isAdminAgentWorkflowApprovalSubject("COMMENT")).toBe(false);
  });

  it("adds business-readable approval summary copy", () => {
    expect(withGenericApprovalSummary("巡检完成。", { decision: "approve" })).toBe(
      "巡检完成。\n管理员已确认继续执行。",
    );
    expect(withGenericApprovalSummary("巡检完成。", { decision: "defer" })).toBe(
      "巡检完成。\n管理员选择暂不继续执行。",
    );
    expect(withGenericApprovalSummary("巡检完成。", null)).toBe("巡检完成。");
  });

  it("keeps approval payload output free of orchestration runtime details", () => {
    expect(
      toBusinessApprovalOutput({
        checkpointId: "checkpoint-1",
        child: {
          threadId: "thread-1",
          title: "保留业务字段",
        },
        notes: ["正常说明", "打开 /agent/runs/thread-1 LangGraph 运行面板"],
        result: {
          appliedCount: 1,
        },
        workflow: "comment_moderation",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    ).toEqual({
      child: {
        title: "保留业务字段",
      },
      notes: ["正常说明"],
      result: {
        appliedCount: 1,
      },
    });
  });
});
