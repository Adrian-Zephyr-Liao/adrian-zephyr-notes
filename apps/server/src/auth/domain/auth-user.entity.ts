type AuthUser = {
  id: string;
  githubId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
};

type GithubUserProfile = {
  githubId: string;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  profileUrl: string;
};

export type { AuthUser, GithubUserProfile };
