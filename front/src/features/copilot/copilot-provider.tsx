"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import type { CopilotPageContext } from "./api";

type PageRecord = Omit<CopilotPageContext, "page">;

type CopilotState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** What the current page declared (open record / selected rows) + its path. */
  context: CopilotPageContext;
  setRecord: (record: PageRecord | null) => void;
};

const Context = React.createContext<CopilotState | null>(null);

const OPEN_KEY = "mk_copilot_open";

/** The copilot's open state and the page context, for the whole dashboard (mounted in its layout). */
export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpenState] = React.useState(false);
  const [record, setRecord] = React.useState<PageRecord | null>(null);

  React.useEffect(() => {
    try {
      // Keep the drawer open across visits on desktop (a browser-only preference).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only preference
      setOpenState(window.localStorage.getItem(OPEN_KEY) === "1" && window.matchMedia("(min-width: 1024px)").matches);
    } catch {
      // Storage blocked: closed by default.
    }
  }, []);

  const setOpen = React.useCallback((next: boolean) => {
    setOpenState(next);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  }, []);

  const value = React.useMemo<CopilotState>(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen(!open),
      context: { page: pathname ?? undefined, ...(record ?? {}) },
      setRecord,
    }),
    [open, setOpen, pathname, record],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCopilot(): CopilotState {
  const state = React.useContext(Context);
  if (!state) throw new Error("useCopilot must be used inside CopilotProvider");
  return state;
}

/**
 * A page tells the copilot what is open on it (one line, optional): `useCopilotContext({ entity: { type:
 * "products", id } })` or the selected rows `{ selection: { type: "orders", ids } }`. Cleared when the page goes.
 */
export function useCopilotContext(record: PageRecord | null) {
  const state = React.useContext(Context);
  const setRecord = state?.setRecord;
  const key = JSON.stringify(record);
  React.useEffect(() => {
    if (!setRecord) return;
    setRecord(key === "null" ? null : (JSON.parse(key) as PageRecord));
    return () => setRecord(null);
  }, [key, setRecord]);
}
