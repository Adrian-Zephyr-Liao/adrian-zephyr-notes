import { Inject, Injectable } from "@nestjs/common";
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from "../domain/auth-session.repository";

@Injectable()
class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
  ) {}

  execute(token: string | undefined) {
    return this.authSessionRepository.deleteSession(token);
  }
}

export { LogoutUseCase };
