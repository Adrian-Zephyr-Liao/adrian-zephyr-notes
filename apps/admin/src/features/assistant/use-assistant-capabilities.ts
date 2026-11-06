import type { AssistantCapabilitiesResponse } from "@adrian-zephyr-notes/contracts";
import { useEffect, useState } from "react";
import { getAssistantCapabilities } from "./assistant-api";

function useAssistantCapabilities(owner?: string) {
  const [capabilities, setCapabilities] = useState<AssistantCapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stale = false;
    setCapabilities(null);
    setLoading(true);
    setFailed(false);
    void getAssistantCapabilities()
      .then((response) => {
        if (!stale) setCapabilities(response);
      })
      .catch(() => {
        if (!stale) setFailed(true);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [owner]);
  return { capabilities, loading, failed };
}

export { useAssistantCapabilities };
