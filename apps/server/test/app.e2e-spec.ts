import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import request from "supertest";
import { App } from "supertest/types";

describe.skipIf(!process.env.ASSISTANT_TEST_DATABASE_URL)("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.stubEnv("DATABASE_URL", process.env.ASSISTANT_TEST_DATABASE_URL);
    const { AppModule } = await import("../src/app.module.js");
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/ (GET)", () => {
    return request(app.getHttpServer()).get("/").expect(200).expect("Hello World!");
  });

  afterEach(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
