import type { AssistantCapabilitiesResponse } from "@adrian-zephyr-notes/contracts";
import { useEffect, useState } from "react";
import { getAssistantCapabilities } from "./assistant-api";

function useAssistantCapabilities(owner?: string) {
  const [capabilities, setCapabilities] = useState<AssistantCapabilitiesResponse | null>();
  useEffect(() => {
    let stale = false;
    setCapabilities(undefined);
    void getAssistantCapabilities()
      .then((response) => {
        if (!stale) setCapabilities(response);
      })
      .catch(() => {
        if (!stale) setCapabilities(null);
      });
    return () => {
      stale = true;
    };
  }, [owner]);
  return { capabilities, loading: capabilities === undefined, failed: capabilities === null };
}

export { useAssistantCapabilities };
