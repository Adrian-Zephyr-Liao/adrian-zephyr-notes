type DraftValue = {
  body: string;
  nickname: string;
  replyId: string | null;
  revision: string;
};

type DraftSnapshot = { key: string; value: DraftValue };

export type { DraftValue, DraftSnapshot };
