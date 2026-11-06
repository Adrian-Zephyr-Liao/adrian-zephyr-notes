import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../core/api.ts";
import { prepareMarkdown, readImage, uploadMarkdown } from "./images.ts";

const directories: string[] = [];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1cAAAAASUVORK5CYII=",
  "base64",
);
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "azn-images-"));
  directories.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
  vi.restoreAllMocks();
});

describe("Markdown local image preparation", () => {
  it("parses inline/reference images, skips code and remote URLs, deduplicates uploads and preserves other source", async () => {
    const root = await directory();
    await writeFile(join(root, "中文 image.png"), png);
    const markdown =
      '# 文章\n\n![内联](<中文 image.png> "原题")\n\n![引用][pic]\n\n[pic]: <中文 image.png>\n\n`![code](missing.png)`\n\n```md\n![code](missing.png)\n```\n\n![remote](https://cdn.example/keep.png)\n';
    const prepared = await prepareMarkdown(markdown, root);
    expect(prepared.images).toHaveLength(1);
    expect(prepared.replacements).toHaveLength(2);
    const client = new ApiClient("https://api.example", "test_token");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ url: "https://cdn.example/upload.png", key: "upload.png" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await uploadMarkdown(client, prepared);
    expect(fetch).toHaveBeenCalledTimes(1);
    const init = fetch.mock.calls[0]![1]!;
    expect(init.body).toBeInstanceOf(FormData);
    const file = (init.body as FormData).get("file") as File;
    expect(file.name).toBe("中文 image.png");
    expect(file.type).toBe("image/png");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(png));
    expect(result.markdown).toBe(
      markdown
        .replace(
          '![内联](<中文 image.png> "原题")',
          '![内联](<https://cdn.example/upload.png> "原题")',
        )
        .replace("![引用][pic]", "![引用](<https://cdn.example/upload.png>)"),
    );
    expect(await readFile(join(root, "中文 image.png"))).toEqual(png);
  });

  it("validates every image before the first write and rejects traversal, symlink escape and file URLs", async () => {
    const root = await directory();
    const outside = await directory();
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "good.png"), png);
    await writeFile(join(outside, "outside.png"), png);
    await symlink(join(outside, "outside.png"), join(root, "escape.png"));
    await expect(
      prepareMarkdown("![ok](good.png)\n![missing](missing.png)", root),
    ).rejects.toThrow();
    await expect(prepareMarkdown("![bad](escape.png)", root)).rejects.toMatchObject({
      code: "IMAGE_OUTSIDE_ROOT",
    });
    await expect(prepareMarkdown("![bad](../outside.png)", join(root, "nested"))).rejects.toThrow();
    await expect(prepareMarkdown("![bad](file:///etc/passwd)", root)).rejects.toMatchObject({
      code: "INVALID_IMAGE_PATH",
    });
  });

  it("rejects empty, oversized and unsupported files using content signatures", async () => {
    const root = await directory();
    await writeFile(join(root, "empty.png"), "");
    await writeFile(join(root, "fake.png"), "not an image");
    await writeFile(join(root, "large.png"), Buffer.alloc(10 * 1024 * 1024 + 1));
    await expect(readImage(join(root, "empty.png"))).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
    await expect(readImage(join(root, "fake.png"))).rejects.toMatchObject({
      code: "IMAGE_TYPE_UNSUPPORTED",
    });
    await expect(readImage(join(root, "large.png"))).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
  });

  it("never retries a failed upload and returns completed upload receipts on stderr", async () => {
    const root = await directory();
    await writeFile(join(root, "a.png"), png);
    await writeFile(join(root, "b.png"), png);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://cdn.example/a.png" })))
      .mockRejectedValueOnce(new Error("lost response"));
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    await expect(
      uploadMarkdown(
        new ApiClient("https://api.example", "test"),
        await prepareMarkdown("![a](a.png)\n![b](b.png)", root),
      ),
    ).rejects.toMatchObject({
      code: "REQUEST_FAILED",
      message: expect.stringContaining("outcome may be unknown"),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('"articleWritten":false'));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("https://cdn.example/a.png"));
  });
});

it("uses the first CommonMark reference definition without uploading a later duplicate", async () => {
  const root = await directory();
  const markdown =
    "![chart][chart]\n\n[chart]: https://cdn.example/expected.png\n[chart]: unexpected.png";
  const prepared = await prepareMarkdown(markdown, root);
  expect(prepared.images).toEqual([]);
  expect(prepared.replacements).toEqual([]);
});
