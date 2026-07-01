type AuthUserResponse = {
  id: string;
  githubId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
};

export type { AuthUserResponse };
