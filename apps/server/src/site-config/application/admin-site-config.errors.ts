class AdminSiteConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

class AdminSiteAnnouncementNotFoundError extends Error {
  constructor() {
    super("Site announcement not found.");
  }
}

export { AdminSiteAnnouncementNotFoundError, AdminSiteConfigValidationError };
