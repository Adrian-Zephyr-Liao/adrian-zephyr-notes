import {
  CopilotChatReasoningMessage,
  type CopilotChatReasoningMessageProps,
} from "@copilotkit/react-core/v2";
import { BrainCircuit, ChevronDown, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/utils";

function AgentReasoningMessageView({
  className,
  isRunning = false,
  message,
  messages = [],
}: CopilotChatReasoningMessageProps) {
  const contentId = useId();
  const isActive = isRunning && messages.at(-1)?.id === message.id;
  const hasContent = Boolean(message.content.trim());
  const [isOpen, setIsOpen] = useState(isActive);
  const userToggledRef = useRef(false);

  useEffect(() => {
    if (isActive) {
      userToggledRef.current = false;
      setIsOpen(true);
      return;
    }

    if (!userToggledRef.current) {
      setIsOpen(false);
    }
  }, [isActive]);

  const StatusIcon = isActive ? LoaderCircle : BrainCircuit;

  return (
    <div
      className={cn("my-1 w-full max-w-[min(720px,100%)] py-1", className)}
      data-message-id={message.id}
    >
      <button
        aria-controls={contentId}
        aria-expanded={isOpen}
        disabled={!hasContent}
        className="group flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-muted-foreground transition-colors duration-150 ease-(--ease-out-ui) hover:bg-background/35 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
        type="button"
        onClick={() => {
          userToggledRef.current = true;
          setIsOpen((current) => !current);
        }}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <StatusIcon
            aria-hidden="true"
            className={cn("size-4", isActive && "animate-spin motion-reduce:animate-none")}
          />
        </span>
        <span aria-live="polite" className="font-medium text-foreground/80">
          {isActive ? "正在思考" : "思考完成"}
        </span>
        <span className="flex-1" />
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 transition-transform duration-200 ease-(--ease-out-ui) motion-reduce:transition-none",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-(--ease-out-ui) motion-reduce:transition-none"
        id={contentId}
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <CopilotChatReasoningMessage.Content
            className="px-3 pb-2 pl-11 text-sm"
            hasContent={hasContent}
            isStreaming={isActive}
          >
            {message.content}
          </CopilotChatReasoningMessage.Content>
        </div>
      </div>
    </div>
  );
}

const AgentReasoningMessage = Object.assign(AgentReasoningMessageView, {
  Content: CopilotChatReasoningMessage.Content,
  Header: CopilotChatReasoningMessage.Header,
  Toggle: CopilotChatReasoningMessage.Toggle,
});

export { AgentReasoningMessage };
