import type { AdminAgentCommentForAnalysis } from "./admin-agent-comment-analysis";

type ListVisibleCommentsByIdsForAnalysisInput = {
  ids: string[];
};

interface AdminAgentCommentSelectionReader {
  listVisibleCommentsByIdsForAnalysis(
    input: ListVisibleCommentsByIdsForAnalysisInput,
  ): Promise<AdminAgentCommentForAnalysis[]>;
}

const ADMIN_AGENT_COMMENT_SELECTION_READER = Symbol("ADMIN_AGENT_COMMENT_SELECTION_READER");

export { ADMIN_AGENT_COMMENT_SELECTION_READER };
export type { AdminAgentCommentSelectionReader, ListVisibleCommentsByIdsForAnalysisInput };
