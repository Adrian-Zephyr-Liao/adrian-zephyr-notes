// Actual compiled controller and Nest interceptor; only authorization and storage are test doubles.
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

const requireCompiled = createRequire(import.meta.url);
const { AdminArticleImagesController } = requireCompiled(
  "../../dist/articles/presentation/admin-article-images.controller.js",
);
const { UploadAdminArticleImageUseCase } = requireCompiled(
  "../../dist/articles/application/upload-admin-article-image.use-case.js",
);
const { AdminApiAccessGuard } = requireCompiled(
  "../../dist/oauth/presentation/admin-api-access.guard.js",
);

async function main() {
  let uploadedFiles = 0;
  const module = await Test.createTestingModule({
    controllers: [AdminArticleImagesController],
    providers: [
      {
        provide: UploadAdminArticleImageUseCase,
        useValue: {
          execute: async () => {
            uploadedFiles += 1;
            return { url: "https://example.test/image.png" };
          },
        },
      },
    ],
  })
    .overrideGuard(AdminApiAccessGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = module.createNestApplication({ logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const endpoint = `http://127.0.0.1:${app.getHttpServer().address().port}/api/admin/articles/images`;
    const mode = process.argv[2];
    const form = new FormData();
    if (mode === "text") form.append("caption", "unused text");
    if (mode === "nested") form.append(`meta${"[x]".repeat(16)}`, "unused text");
    if (mode === "array-index") {
      form.append("items[4294967294]", "sparse array");
      form.append("items[]", "overflows array length without iterating it");
    }
    form.append("file", new Blob(["image fixture"], { type: "image/png" }), "note.png");
    const initial = await fetch(endpoint, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(2_000),
    });
    await initial.arrayBuffer();
    await delay(200);
    const valid = new FormData();
    valid.append("file", new Blob(["image fixture"], { type: "image/png" }), "note.png");
    const subsequent = await fetch(endpoint, {
      method: "POST",
      body: valid,
      signal: AbortSignal.timeout(2_000),
    });
    await subsequent.arrayBuffer();
    console.log(
      JSON.stringify({
        initialStatus: initial.status,
        subsequentStatus: subsequent.status,
        uploadedFiles,
      }),
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
