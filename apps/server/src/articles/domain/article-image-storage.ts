type ArticleImageStoragePutInput = {
  body: Buffer;
  key: string;
  mimeType: string;
};

type ArticleImageStoragePutResult = {
  key: string;
  url: string;
};

interface ArticleImageStorage {
  put(input: ArticleImageStoragePutInput): Promise<ArticleImageStoragePutResult>;
}

const ARTICLE_IMAGE_STORAGE = Symbol("ARTICLE_IMAGE_STORAGE");

export { ARTICLE_IMAGE_STORAGE };
export type { ArticleImageStorage, ArticleImageStoragePutInput, ArticleImageStoragePutResult };
