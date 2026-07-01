import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { AuthUser, GithubUserProfile } from "../domain/auth-user.entity";
import type { AuthUserRepository } from "../domain/auth-user.repository";

@Injectable()
class PrismaAuthUserRepository implements AuthUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertGithubUser(profile: GithubUserProfile): Promise<AuthUser> {
    return this.prisma.user.upsert({
      where: {
        githubId: profile.githubId,
      },
      update: {
        login: profile.login,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        profileUrl: profile.profileUrl,
      },
      create: {
        githubId: profile.githubId,
        login: profile.login,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        profileUrl: profile.profileUrl,
      },
    });
  }
}

export { PrismaAuthUserRepository };
