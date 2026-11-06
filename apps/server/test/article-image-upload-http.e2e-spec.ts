import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const runNode = promisify(execFile);

describe("compiled article image multipart boundary", () => {
  it.each(["valid", "text", "nested", "array-index"])(
    "%s multipart input leaves the process alive and permits a subsequent upload",
    async (mode) => {
      const { stdout, stderr } = await runNode(
        process.execPath,
        [join(__dirname, "fixtures/article-image-upload-server.mjs"), mode],
        { env: {}, timeout: 10_000, killSignal: "SIGKILL" },
      );
      expect(stderr).toBe("");
      expect(JSON.parse(stdout)).toEqual({
        initialStatus: mode === "valid" ? 201 : 400,
        subsequentStatus: 201,
        uploadedFiles: mode === "valid" ? 2 : 1,
      });
    },
    15_000,
  );
});
