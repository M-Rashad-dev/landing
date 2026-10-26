"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { isApiError, errorMessage } from "@/lib/api/errors";
import { savePageContent, type PageDetail } from "@/lib/pages/api";
import { toast } from "@/components/ui/toaster";
import type { BuilderStore } from "./store";

const DEBOUNCE_MS = 1500;

/**
 * Saves the draft 1.5 s after the last edit (plus manual save). A 409 opens the
 * conflict flow with the server's newer version.
 */
export function useAutosave(store: BuilderStore, pageId: number) {
  const content = useStore(store, (s) => s.content);
  const themeKey = useStore(store, (s) => s.themeKey);
  const dirty = useStore(store, (s) => s.dirty);
  const [conflict, setConflict] = useState<PageDetail | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);

  const save = useCallback(
    async (options: { overrideVersion?: number } = {}): Promise<boolean> => {
      if (inFlight.current) await inFlight.current;
      const state = store.getState();
      if (!state.dirty && options.overrideVersion === undefined) return true;

      const sent = state.content;
      const run = (async () => {
        state.markSaving();
        try {
          const saved = await savePageContent(pageId, { version: options.overrideVersion ?? state.version, content: sent, theme_key: state.themeKey });
          store.getState().markSaved(saved.version, sent);
          return true;
        } catch (error) {
          store.getState().markError();
          if (isApiError(error) && error.status === 409 && error.code === "version_conflict") {
            setConflict((error.body.current as PageDetail | undefined) ?? null);
          } else {
            const first = isApiError(error) ? Object.values(error.errors)[0]?.[0] : undefined;
            toast.error(first ?? errorMessage(error));
          }
          return false;
        }
      })();

      inFlight.current = run;
      const ok = await run;
      inFlight.current = null;
      return ok;
    },
    [pageId, store],
  );

  // Debounced autosave on every content/theme change.
  useEffect(() => {
    if (!dirty || conflict) return;
    const timer = setTimeout(() => void save(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [content, themeKey, dirty, conflict, save]);

  // Guard against closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const reloadFromServer = useCallback(() => {
    if (!conflict) return;
    store.getState().replaceFromServer({ content: conflict.draft_content, themeKey: conflict.theme_key, version: conflict.version });
    setConflict(null);
  }, [conflict, store]);

  const overwrite = useCallback(async () => {
    if (!conflict) return;
    const version = conflict.version;
    setConflict(null);
    await save({ overrideVersion: version });
  }, [conflict, save]);

  return { save, conflict, reloadFromServer, overwrite };
}
