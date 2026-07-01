import type { AuthUser } from "./auth-user.entity";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type CreatedSession = {
  token: string;
  expiresAt: Date;
  maxAgeSeconds: number;
};

interface AuthSessionRepository {
  createSession(userId: string): Promise<CreatedSession>;
  findUserByToken(token: string | undefined): Promise<AuthUser | null>;
  deleteSession(token: string | undefined): Promise<void>;
}

const AUTH_SESSION_REPOSITORY = Symbol("AUTH_SESSION_REPOSITORY");

export {
  AUTH_SESSION_REPOSITORY,
  SESSION_TTL_SECONDS,
  type AuthSessionRepository,
  type CreatedSession,
};
