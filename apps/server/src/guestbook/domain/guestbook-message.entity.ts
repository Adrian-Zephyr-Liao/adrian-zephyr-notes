const GUESTBOOK_MESSAGE_BODY_MAX_LENGTH = 1000;
const GUESTBOOK_NICKNAME_MAX_LENGTH = 32;

class GuestbookMessageBody {
  private constructor(private readonly value: string) {}

  static create(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new GuestbookMessageBodyEmptyError();
    }

    if (normalizedValue.length > GUESTBOOK_MESSAGE_BODY_MAX_LENGTH) {
      throw new GuestbookMessageBodyTooLongError();
    }

    return new GuestbookMessageBody(normalizedValue);
  }

  toString() {
    return this.value;
  }
}

class GuestbookNickname {
  private constructor(private readonly value: string) {}

  static create(value: string | null | undefined) {
    const normalizedValue = value?.trim() ?? "";

    if (!normalizedValue) {
      throw new GuestbookNicknameRequiredError();
    }

    if (normalizedValue.length > GUESTBOOK_NICKNAME_MAX_LENGTH) {
      throw new GuestbookNicknameTooLongError();
    }

    return new GuestbookNickname(normalizedValue);
  }

  toString() {
    return this.value;
  }
}

class GuestbookMessageBodyEmptyError extends Error {
  constructor() {
    super("Guestbook message body is required.");
  }
}

class GuestbookMessageBodyTooLongError extends Error {
  constructor() {
    super(
      `Guestbook message body must be at most ${GUESTBOOK_MESSAGE_BODY_MAX_LENGTH} characters.`,
    );
  }
}

class GuestbookNicknameRequiredError extends Error {
  constructor() {
    super("Guest nickname is required.");
  }
}

class GuestbookNicknameTooLongError extends Error {
  constructor() {
    super(`Guest nickname must be at most ${GUESTBOOK_NICKNAME_MAX_LENGTH} characters.`);
  }
}

export {
  GUESTBOOK_MESSAGE_BODY_MAX_LENGTH,
  GUESTBOOK_NICKNAME_MAX_LENGTH,
  GuestbookMessageBody,
  GuestbookMessageBodyEmptyError,
  GuestbookMessageBodyTooLongError,
  GuestbookNickname,
  GuestbookNicknameRequiredError,
  GuestbookNicknameTooLongError,
};
