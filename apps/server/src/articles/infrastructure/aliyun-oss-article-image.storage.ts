import Credential, { Config as CredentialConfig } from "@alicloud/credentials";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OSS from "ali-oss";
import {
  ArticleImageStorageError,
  ArticleImageStorageUnavailableError,
} from "../application/article-image-upload.errors";
import type {
  ArticleImageStorage,
  ArticleImageStoragePutInput,
  ArticleImageStoragePutResult,
} from "../domain/article-image-storage";

type ArticleImageOssClientSettings = {
  bucket: string;
  internal: boolean;
  region: string;
};

type ArticleImageOssClient = Pick<OSS, "put">;
type ArticleImageOssClientFactory = (
  settings: ArticleImageOssClientSettings,
) => Promise<ArticleImageOssClient>;

const ARTICLE_IMAGE_OSS_CLIENT_FACTORY = Symbol("ARTICLE_IMAGE_OSS_CLIENT_FACTORY");

@Injectable()
class AliyunOssArticleImageStorage implements ArticleImageStorage {
  private clientPromise?: Promise<ArticleImageOssClient>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(ARTICLE_IMAGE_OSS_CLIENT_FACTORY)
    private readonly createClient: ArticleImageOssClientFactory,
  ) {}

  async put(input: ArticleImageStoragePutInput): Promise<ArticleImageStoragePutResult> {
    const config = readArticleImageOssConfig(this.configService);

    try {
      const client = await this.getClient(config);
      await client.put(input.key, input.body, {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Type": input.mimeType,
        },
      });
    } catch (error) {
      if (error instanceof ArticleImageStorageError) {
        throw error;
      }

      throw new ArticleImageStorageError("文章图片上传到 OSS 失败。", { cause: error });
    }

    return {
      key: input.key,
      url: `${config.publicBaseUrl}/${input.key}`,
    };
  }

  private getClient(config: ArticleImageOssConfig) {
    if (!this.clientPromise) {
      this.clientPromise = this.createClient({
        bucket: config.bucket,
        internal: config.internal,
        region: config.region,
      }).catch((error: unknown) => {
        this.clientPromise = undefined;
        throw new ArticleImageStorageError("无法取得 OSS 临时凭证。", { cause: error });
      });
    }

    return this.clientPromise;
  }
}

type ArticleImageOssConfig = ArticleImageOssClientSettings & {
  publicBaseUrl: string;
};

function readArticleImageOssConfig(configService: ConfigService): ArticleImageOssConfig {
  const bucket = configService.get<string>("OSS_BUCKET")?.trim();
  const region = configService.get<string>("OSS_REGION")?.trim();
  const publicBaseUrl = normalizePublicBaseUrl(
    configService.get<string>("OSS_PUBLIC_BASE_URL")?.trim(),
  );

  if (!bucket || !region || !publicBaseUrl) {
    throw new ArticleImageStorageUnavailableError(
      "文章图床尚未配置，请设置 OSS_REGION、OSS_BUCKET 和 OSS_PUBLIC_BASE_URL。",
    );
  }

  return {
    bucket,
    internal: configService.get<string>("OSS_INTERNAL")?.trim().toLowerCase() === "true",
    publicBaseUrl,
    region,
  };
}

function normalizePublicBaseUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

async function createAliyunOssClient(
  settings: ArticleImageOssClientSettings,
): Promise<ArticleImageOssClient> {
  const credentialsConfig = new CredentialConfig({
    roleName: process.env.ALIBABA_CLOUD_ECS_METADATA,
    type: "ecs_ram_role",
  });
  const credentialClient = new Credential(credentialsConfig);
  const credentials = await requireOssCredentials(credentialClient);

  return new OSS({
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    bucket: settings.bucket,
    internal: settings.internal,
    refreshSTSToken: async () => requireOssCredentials(credentialClient),
    refreshSTSTokenInterval: 0,
    region: settings.region,
    secure: true,
    stsToken: credentials.stsToken,
  });
}

async function requireOssCredentials(credentialClient: Credential) {
  const credentials = await credentialClient.getCredential();
  const accessKeyId = credentials.accessKeyId?.trim();
  const accessKeySecret = credentials.accessKeySecret?.trim();
  const stsToken = credentials.securityToken?.trim();

  if (!accessKeyId || !accessKeySecret || !stsToken) {
    throw new Error("The ECS RAM role did not return complete STS credentials.");
  }

  return { accessKeyId, accessKeySecret, stsToken };
}

export {
  ARTICLE_IMAGE_OSS_CLIENT_FACTORY,
  AliyunOssArticleImageStorage,
  createAliyunOssClient,
  readArticleImageOssConfig,
};
export type { ArticleImageOssClient, ArticleImageOssClientFactory, ArticleImageOssClientSettings };
