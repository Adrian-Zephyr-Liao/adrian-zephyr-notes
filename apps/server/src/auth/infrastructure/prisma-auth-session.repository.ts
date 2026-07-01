import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { SESSION_TTL_SECONDS, type AuthSessionRepository } from "../domain/auth-session.repository";
import type { AuthUser } from "../domain/auth-user.entity";

@Injectable()
class PrismaAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    await this.prisma.userSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      token,
      expiresAt,
      maxAgeSeconds: SESSION_TTL_SECONDS,
    };
  }

  async findUserByToken(token: string | undefined): Promise<AuthUser | null> {
    if (!token) {
      return null;
    }

    const session = await this.prisma.userSession.findUnique({
      where: {
        tokenHash: hashToken(token),
      },
      include: {
        user: true,
      },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    await this.prisma.userSession.update({
      where: {
        id: session.id,
      },
      data: {
        lastSeenAt: new Date(),
      },
    });

    return session.user;
  }

  async deleteSession(token: string | undefined) {
    if (!token) {
      return;
    }

    await this.prisma.userSession.deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    });
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export { PrismaAuthSessionRepository, hashToken };
