"use client";

import * as React from "react";

/**
 * Opens the AI designer when the Builder was reached from the store copilot's button (`?ai=1&prompt=…`), with the
 * merchant's request filled in (not sent). Runs once, when the designer is available, and cleans the URL so a
 * reload doesn't open it again.
 */
export function useDesignerHandoff(enabled: boolean, onOpen: (prompt: string) => void) {
  const done = React.useRef(false);
  const latest = React.useRef(onOpen);
  React.useEffect(() => {
    latest.current = onOpen;
  });
  React.useEffect(() => {
    if (!enabled || done.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("ai") !== "1") return;
    done.current = true;
    const prompt = (params.get("prompt") ?? "").slice(0, 1000);
    params.delete("ai");
    params.delete("prompt");
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    latest.current(prompt);
  }, [enabled]);
}
