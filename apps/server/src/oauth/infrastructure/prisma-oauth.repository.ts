import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import type { DeviceExchangeResult, OAuthRepository } from "../domain/oauth.repository";

@Injectable()
class PrismaOAuthRepository implements OAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDevice(input: Parameters<OAuthRepository["createDevice"]>[0]) {
    await this.prisma.oAuthDeviceAuthorization.create({ data: input });
  }

  findDevice(userCodeHash: string) {
    return this.prisma.oAuthDeviceAuthorization.findUnique({ where: { userCodeHash } });
  }

  decideDevice(userCodeHash: string, userId: string, allow: boolean) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM oauth_device_authorizations WHERE user_code_hash = ${userCodeHash} FOR UPDATE
      `;
      const device = await transaction.oAuthDeviceAuthorization.findUnique({
        where: { userCodeHash },
      });
      if (!device) return false;
      const status = allow ? "APPROVED" : "DENIED";
      if (device.status !== "PENDING") {
        return (
          device.userId === userId &&
          (device.status === status || (allow && device.status === "CONSUMED"))
        );
      }
      if (device.expiresAt.getTime() <= Date.now()) return false;
      await transaction.oAuthDeviceAuthorization.update({
        where: { id: device.id },
        data: { status, userId },
      });
      return true;
    });
  }

  exchangeDevice(
    clientId: string,
    deviceCodeHash: string,
    tokenHash: string,
    tokenTtlSeconds: number,
    canAccess: (user: AuthUser) => boolean,
  ): Promise<DeviceExchangeResult> {
    return this.prisma.$transaction(async (transaction) => {
      // Serialize polling, approval and consumption across server processes.
      await transaction.$queryRaw`
        SELECT id FROM oauth_device_authorizations WHERE device_code_hash = ${deviceCodeHash} FOR UPDATE
      `;
      const device = await transaction.oAuthDeviceAuthorization.findUnique({
        where: { deviceCodeHash },
        include: { user: true },
      });
      const now = new Date();
      if (!device || device.clientId !== clientId) return { status: "invalid_grant" };
      if (device.expiresAt <= now) return { status: "expired_token" };
      if (device.status === "CONSUMED") return { status: "invalid_grant" };
      if (device.status === "DENIED") return { status: "access_denied" };
      if (device.nextPollAt && device.nextPollAt > now) {
        const intervalSeconds = device.intervalSeconds + 5;
        await transaction.oAuthDeviceAuthorization.update({
          where: { id: device.id },
          data: { intervalSeconds, nextPollAt: new Date(now.getTime() + intervalSeconds * 1000) },
        });
        return { status: "slow_down" };
      }
      await transaction.oAuthDeviceAuthorization.update({
        where: { id: device.id },
        data: { nextPollAt: new Date(now.getTime() + device.intervalSeconds * 1000) },
      });
      if (device.status === "PENDING") return { status: "authorization_pending" };
      if (!device.user || !canAccess(device.user)) return { status: "access_denied" };
      await transaction.oAuthDeviceAuthorization.update({
        where: { id: device.id },
        data: { status: "CONSUMED" },
      });
      await transaction.oAuthAccessToken.create({
        data: {
          tokenHash,
          expiresAt: new Date(now.getTime() + tokenTtlSeconds * 1000),
          userId: device.user.id,
          clientId: device.clientId,
          scope: device.scope,
        },
      });
      return { status: "issued", scope: device.scope };
    });
  }

  findToken(tokenHash: string) {
    return this.prisma.oAuthAccessToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async revokeToken(clientId: string, tokenHash: string) {
    await this.prisma.oAuthAccessToken.deleteMany({ where: { clientId, tokenHash } });
  }
}

export { PrismaOAuthRepository };
