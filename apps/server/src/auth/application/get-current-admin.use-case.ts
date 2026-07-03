import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminAccessPolicy } from "../domain/admin-access-policy";
import { GetCurrentUserUseCase } from "./get-current-user.use-case";

@Injectable()
class GetCurrentAdminUseCase {
  constructor(
    private readonly configService: ConfigService,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  async execute(token: string | undefined) {
    const user = await this.getCurrentUser.execute(token);
    const policy = new AdminAccessPolicy(this.configService.get<string>("ADMIN_GITHUB_LOGINS"));

    return policy.canAccess(user) ? user : null;
  }
}

export { GetCurrentAdminUseCase };
