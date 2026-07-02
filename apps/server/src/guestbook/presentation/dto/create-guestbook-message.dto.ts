import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import {
  GUESTBOOK_MESSAGE_BODY_MAX_LENGTH,
  GUESTBOOK_NICKNAME_MAX_LENGTH,
} from "../../domain/guestbook-message.entity";

class CreateGuestbookMessageDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1)
  @MaxLength(GUESTBOOK_MESSAGE_BODY_MAX_LENGTH)
  body!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MaxLength(GUESTBOOK_NICKNAME_MAX_LENGTH)
  guestNickname?: string | null;

  @IsOptional()
  @IsString()
  website?: string | null;
}

export { CreateGuestbookMessageDto };
