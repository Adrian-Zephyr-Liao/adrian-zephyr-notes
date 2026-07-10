import { describe, expect, it, vi } from "vitest";
import type { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import type { UpdateAdminSiteAnnouncementUseCase } from "../../site-config/application/update-admin-site-announcement.use-case";
import { AdminAgentWorkflowActionValidationError } from "../domain/admin-agent-workflow-action-executor";
import { SiteConfigAgentActionHandler } from "./site-config-agent-action.handler";

describe("SiteConfigAgentActionHandler", () => {
  it("updates a site announcement and records an admin operation", async () => {
    const recordAdminOperation = {
      execute: vi.fn(),
    } as unknown as RecordAdminOperationUseCase & {
      execute: ReturnType<typeof vi.fn>;
    };
    const updateAnnouncement = {
      execute: vi.fn(async () => ({
        command: "查看公告",
        createdAt: new Date("2026-07-04T10:00:00.000Z"),
        icon: "sparkles",
        iconClassName: "text-primary",
        id: "announcement-1",
        isEnabled: false,
        key: "welcome",
        output: "展示欢迎公告",
        process: "首页公告",
        sortOrder: 20,
        status: "暂停",
        title: "欢迎",
        updatedAt: new Date("2026-07-04T10:00:00.000Z"),
      })),
    } as unknown as UpdateAdminSiteAnnouncementUseCase & {
      execute: ReturnType<typeof vi.fn>;
    };
    const handler = new SiteConfigAgentActionHandler(recordAdminOperation, updateAnnouncement);

    await expect(
      handler.execute({
        action: "UPDATE_SITE_ANNOUNCEMENT",
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        payload: {
          announcementId: "announcement-1",
          isEnabled: false,
          sortOrder: 20,
          status: "暂停",
        },
        requestContext: {
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        subject: "SITE_CONFIG",
      }),
    ).resolves.toEqual({
      appliedCount: 1,
      failedCount: 0,
      results: [
        {
          resourceId: "announcement-1",
          status: "APPLIED",
          summary: "站点公告 welcome 已更新。",
        },
      ],
    });
    expect(updateAnnouncement.execute).toHaveBeenCalledWith({
      command: undefined,
      icon: undefined,
      iconClassName: undefined,
      id: "announcement-1",
      isEnabled: false,
      output: undefined,
      process: undefined,
      sortOrder: 20,
      status: "暂停",
      title: undefined,
    });
    expect(recordAdminOperation.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SITE_ANNOUNCEMENT_UPDATED",
        metadata: expect.objectContaining({
          agentAction: "UPDATE_SITE_ANNOUNCEMENT",
          key: "welcome",
          source: "admin_agent",
        }),
        resourceId: "announcement-1",
        resourceType: "site_announcement",
      }),
    );
  });

  it("validates the target announcement id", async () => {
    const handler = new SiteConfigAgentActionHandler(
      { execute: vi.fn() } as unknown as RecordAdminOperationUseCase,
      { execute: vi.fn() } as unknown as UpdateAdminSiteAnnouncementUseCase,
    );

    await expect(
      handler.execute({
        action: "UPDATE_SITE_ANNOUNCEMENT",
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        payload: {},
        subject: "SITE_CONFIG",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowActionValidationError);
  });
});
