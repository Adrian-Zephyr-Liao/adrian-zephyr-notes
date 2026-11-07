import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../components/admin/admin-shell";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";
import { AssistantWorkspace } from "../features/assistant/assistant-workspace";

export const Route = createFileRoute("/assistant")({
  validateSearch: (search): { conversation?: string } => ({
    conversation: typeof search.conversation === "string" ? search.conversation : undefined,
  }),
  component: AssistantRoute,
});

function AssistantRoute() {
  const { conversation } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminAuthGate
      returnTo={
        conversation ? `/assistant?conversation=${encodeURIComponent(conversation)}` : "/assistant"
      }
    >
      {(admin, onLogout) => (
        <AdminShell admin={admin} onLogout={onLogout} section="assistant">
          <AssistantWorkspace
            conversationId={conversation}
            onConversationChange={(id) =>
              void navigate({ search: { conversation: id }, replace: true })
            }
          />
        </AdminShell>
      )}
    </AdminAuthGate>
  );
}
