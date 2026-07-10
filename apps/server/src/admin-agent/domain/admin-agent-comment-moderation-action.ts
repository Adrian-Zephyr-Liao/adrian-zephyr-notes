import type { AdminAgentFinding } from "./admin-agent-finding.entity";

function toExecutableCommentModerationFindingIds(
  requestedFindingIds: string[],
  findings: AdminAgentFinding[],
) {
  const pendingHideFindingIds = new Set(
    findings
      .filter(
        (finding) => finding.status === "PENDING" && finding.proposedAction === "HIDE_COMMENT",
      )
      .map((finding) => finding.id),
  );

  return [...new Set(requestedFindingIds)].filter((findingId) =>
    pendingHideFindingIds.has(findingId),
  );
}

export { toExecutableCommentModerationFindingIds };
