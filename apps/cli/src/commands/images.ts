import { Command } from "commander";
import { open, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  markdownImage,
  prepareMarkdown,
  readImage,
  uploadImage,
  uploadMarkdown,
} from "../content/images.ts";
import type { RegisterAction } from "../core/command.ts";
import { CliError } from "../core/errors.ts";
import { readText } from "../core/input.ts";

function registerImageCommands(program: Command, action: RegisterAction): void {
  const images = program.command("images").description("Upload images and prepare Markdown assets");
  action(
    images
      .command("upload <file>")
      .description("Upload PNG, JPEG, GIF or WebP up to 10 MiB")
      .option("--alt <text>", "Markdown image label"),
    async (options, [file], api) => {
      const image = await readImage(file!);
      const result = await uploadImage(api, image);
      return {
        ...result,
        markdown: markdownImage(
          typeof options.alt === "string" ? options.alt : image.name,
          result.url,
        ),
      };
    },
  );
  action(
    images
      .command("prepare <markdown-file>")
      .description("Upload local images and write a new Markdown file")
      .requiredOption("--output <path>", "New Markdown file; never overwrites an existing file")
      .option("--assets-root <directory>", "Allowed image directory; defaults to Markdown parent")
      .option("--dry-run", "Validate and list local images without uploading"),
    async (options, [file], api) => {
      const output = resolve(String(options.output));
      const root =
        typeof options.assetsRoot === "string" ? options.assetsRoot : dirname(resolve(file!));
      if (file === "-" && !options.assetsRoot)
        throw new CliError("INVALID_ARGUMENT", "stdin requires --assets-root");
      const prepared = await prepareMarkdown(await readText(file!), root);
      if (options.dryRun)
        return {
          dryRun: true,
          output,
          images: prepared.images.map(({ path, name, mimeType, bytes }) => ({
            path,
            name,
            mimeType,
            size: bytes.length,
          })),
        };
      // Reserve a new file before any remote write, and never overwrite the source.
      const target = await open(output, "wx", 0o600);
      let completed = false;
      try {
        const result = await uploadMarkdown(api, prepared);
        process.stderr.write(`${JSON.stringify({ imageUploads: result.images })}\n`);
        await target.writeFile(result.markdown, "utf8");
        completed = true;
        return { output, images: result.images };
      } finally {
        await target.close();
        if (!completed) await unlink(output);
      }
    },
  );
}

export { registerImageCommands };
