class GuestbookMessageAuthenticationRequiredError extends Error {
  constructor() {
    super("Login is required to like guestbook messages.");
  }
}

class GuestbookMessageLikeTargetNotFoundError extends Error {
  constructor() {
    super("Guestbook message not found.");
  }
}

class GuestbookMessageRejectedAsSpamError extends Error {
  constructor() {
    super("Guestbook message was rejected.");
  }
}

class GuestbookMessageRateLimitedError extends Error {
  constructor() {
    super("Too many guestbook messages.");
  }
}

export {
  GuestbookMessageAuthenticationRequiredError,
  GuestbookMessageLikeTargetNotFoundError,
  GuestbookMessageRateLimitedError,
  GuestbookMessageRejectedAsSpamError,
};
