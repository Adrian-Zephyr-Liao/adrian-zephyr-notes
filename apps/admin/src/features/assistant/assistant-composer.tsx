import { Loader2, Send, Square } from "lucide-react";
import type { FormEvent, RefObject } from "react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";

const inputLimit = 2000;

function AssistantComposer({
  input,
  inputRef,
  disabled,
  canStop,
  stopping,
  onInputChange,
  onSubmit,
  onStop,
}: {
  input: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  disabled: boolean;
  canStop: boolean;
  stopping: boolean;
  onInputChange: (input: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}) {
  const canSubmit = !disabled && Boolean(input.trim()) && input.length <= inputLimit;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit) onSubmit();
  }

  return (
    <form
      className="mx-auto w-full max-w-3xl shrink-0 space-y-3 rounded-lg border border-border/60 bg-background/35 p-3 focus-within:border-ring/60 sm:p-4"
      onSubmit={submit}
    >
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium" htmlFor="assistant-input">
          你的问题
        </label>
        <span className="text-xs text-muted-foreground tabular-nums" id="assistant-input-length">
          {input.length} / {inputLimit}
        </span>
      </div>
      <Textarea
        aria-describedby="assistant-input-help assistant-input-length"
        className="max-h-32 min-h-16 resize-none rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none focus-visible:bg-transparent focus-visible:ring-0"
        disabled={disabled}
        id="assistant-input"
        maxLength={inputLimit}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey) &&
            !event.nativeEvent.isComposing &&
            event.keyCode !== 229
          ) {
            event.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}
        placeholder="说明想查询的内容和筛选条件…"
        ref={inputRef}
        rows={3}
        value={input}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" id="assistant-input-help">
          Ctrl / ⌘ + Enter 发送，Enter 换行
        </p>
        <div className="ml-auto flex gap-2">
          {canStop ? (
            <Button disabled={stopping} onClick={onStop} type="button" variant="outline">
              {stopping ? <Loader2 className="animate-spin" /> : <Square />}
              {stopping ? "停止中" : "停止请求"}
            </Button>
          ) : null}
          <Button disabled={!canSubmit} type="submit">
            <Send />
            发送
          </Button>
        </div>
      </div>
    </form>
  );
}

export { AssistantComposer };
