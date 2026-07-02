"use client";

import * as React from "react";

function SiteHeaderDisclosure({
  children,
  onClickCapture,
  ...props
}: React.ComponentPropsWithoutRef<"details">) {
  const detailsRef = React.useRef<HTMLDetailsElement>(null);

  React.useEffect(() => {
    function closeDetails() {
      detailsRef.current?.removeAttribute("open");
    }

    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;

      if (!details?.open) {
        return;
      }

      if (event.composedPath().includes(details)) {
        return;
      }

      closeDetails();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDetails();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleClickCapture(event: React.MouseEvent<HTMLDetailsElement>) {
    onClickCapture?.(event);

    const target = event.target;

    if (target instanceof Element && target.closest("a")) {
      requestAnimationFrame(() => {
        detailsRef.current?.removeAttribute("open");
      });
    }
  }

  return (
    <details ref={detailsRef} onClickCapture={handleClickCapture} {...props}>
      {children}
    </details>
  );
}

export { SiteHeaderDisclosure };
