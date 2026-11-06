import { ConfigService } from "@nestjs/config";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
  mkdir: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
}));
let connection: EventEmitter;

vi.mock("pg", () => ({
  default: {
    Client: class {
      private readonly events = new EventEmitter();
      on = this.events.on.bind(this.events);
      connect = mocks.connect;
      query = mocks.query;
      end = mocks.end;
      constructor() {
        connection = this.events;
      }
    },
  },
}));
vi.mock("node:fs/promises", () => ({ mkdir: mocks.mkdir }));
vi.mock("./pi-admin-agent-runtime.mjs", () => ({
  BACKGROUND_CONTEXT: { name: "test" },
  openNodeSqliteStorage: mocks.open,
}));

import { openPiAdminAgentStorage } from "./pi-admin-agent-storage";

const config = new ConfigService({
  DATABASE_URL: "postgresql://test",
  PI_AGENT_STORAGE_DIR: "/tmp/pi-test",
});

describe("Pi durable storage ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.connect.mockResolvedValue(undefined);
    mocks.query.mockResolvedValue({ rows: [{ owned: true }] });
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.open.mockResolvedValue({ close: mocks.close });
    mocks.close.mockResolvedValue(undefined);
    mocks.end.mockImplementation(async () => {
      connection.emit("end");
    });
  });

  it("locks the hashed store identity before opening a private SQLite directory", async () => {
    const handle = await openPiAdminAgentStorage(config, "actor/conversation");
    const hash = createHash("sha256").update("actor/conversation").digest("hex");
    expect(mocks.query).toHaveBeenCalledWith(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS owned",
      [`az-notes:pi:${hash}`],
    );
    expect(mocks.mkdir).toHaveBeenCalledWith("/tmp/pi-test", { recursive: true, mode: 0o700 });
    expect(mocks.open).toHaveBeenCalledWith(resolve("/tmp/pi-test", `${hash}.sqlite`));
    expect(mocks.query.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.open.mock.invocationCallOrder[0]!,
    );
    await handle.close();
  });

  it("rejects another owner without opening or changing its SQLite store", async () => {
    mocks.query.mockResolvedValue({ rows: [{ owned: false }] });
    await expect(openPiAdminAgentStorage(config, "same")).rejects.toThrow("already owned");
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("releases the ownership connection when connecting or opening SQLite fails", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(openPiAdminAgentStorage(config, "one")).rejects.toThrow("database unavailable");
    expect(mocks.end).toHaveBeenCalledOnce();
    mocks.open.mockRejectedValueOnce(new Error("disk unavailable"));
    await expect(openPiAdminAgentStorage(config, "two")).rejects.toThrow("disk unavailable");
    expect(mocks.end).toHaveBeenCalledTimes(2);
  });

  it.each(["error", "end"])("invalidates ownership immediately on connection %s", async (event) => {
    const handle = await openPiAdminAgentStorage(config, "lease");
    const abort = vi.fn();
    handle.ownershipLost.addEventListener("abort", abort);
    const error = new Error("connection lost");
    connection.emit(event, error);
    expect(handle.ownershipLost.aborted).toBe(true);
    expect(abort).toHaveBeenCalledOnce();
    await handle.close();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("closes once and does not report normal shutdown as lease loss", async () => {
    const handle = await openPiAdminAgentStorage(config, "shutdown");
    await Promise.all([handle.close(), handle.close()]);
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.end).toHaveBeenCalledOnce();
    expect(handle.ownershipLost.aborted).toBe(false);
  });

  it("releases the connection even if closing SQLite fails", async () => {
    const handle = await openPiAdminAgentStorage(config, "close-failure");
    mocks.close.mockRejectedValueOnce(new Error("disk close failed"));
    await expect(handle.close()).rejects.toThrow("disk close failed");
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("requires database ownership before touching the filesystem", async () => {
    await expect(
      openPiAdminAgentStorage(new ConfigService({ DATABASE_URL: "" }), "none"),
    ).rejects.toThrow("DATABASE_URL");
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
