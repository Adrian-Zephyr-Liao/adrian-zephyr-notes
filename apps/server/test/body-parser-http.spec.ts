import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const runNode = promisify(execFile);

describe("Nest default HTTP body parser process survival", () => {
  it.each(["valid", "trailing"])(
    "survives a %s gzip request and still parses subsequent requests",
    async (mode) => {
      // A vulnerable decoder must crash only the dedicated child, never the test runner.
      const { stdout, stderr } = await runNode(
        process.execPath,
        [join(__dirname, "fixtures/body-parser-server.mjs"), mode],
        { env: {}, timeout: 10_000, killSignal: "SIGKILL" },
      );
      expect(stderr).toBe("");
      expect(JSON.parse(stdout)).toEqual({
        initialStatus: mode === "valid" ? 201 : 404,
        healthStatus: 200,
        subsequentStatus: 201,
        subsequentBody: { parsed: true },
      });
    },
    15_000,
  );
});
