"use client";

import { useTypewriterText } from "./use-typewriter-text";

type TypewriterTextProps = {
  text: string;
};

function TypewriterText({ text }: TypewriterTextProps) {
  const typedText = useTypewriterText(text);

  return (
    <span className="relative block">
      <span className="sr-only">{text}</span>
      <span className="invisible block" aria-hidden="true">
        {text}
      </span>
      <span className="absolute inset-0 block" aria-hidden="true">
        {typedText.text}
        {typedText.isTyping ? <TypewriterCaret /> : null}
      </span>
    </span>
  );
}

function TypewriterCaret() {
  return (
    <span className="ml-0.5 inline-block h-[1.05em] w-px translate-y-0.5 animate-pulse bg-primary align-text-bottom motion-reduce:hidden" />
  );
}

export { TypewriterText };
