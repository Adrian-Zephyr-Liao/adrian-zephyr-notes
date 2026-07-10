class AdminAgentFindingNotFoundError extends Error {
  constructor() {
    super("Admin agent finding not found.");
  }
}

class AdminAgentFindingDecisionError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export { AdminAgentFindingDecisionError, AdminAgentFindingNotFoundError };
