"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { api, apiPage, apiUpload } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { MediaItem } from "@/lib/types";

export const mediaKeys = {
  all: ["media"] as const,
  list: (q: string) => ["media", "list", q] as const,
  byIds: (ids: number[]) => ["media", "ids", [...ids].sort((a, b) => a - b).join(",")] as const,
};

const PAGE_SIZE = 30;

export function useMediaLibrary(search: string) {
  return useInfiniteQuery({
    queryKey: mediaKeys.list(search),
    queryFn: ({ pageParam, signal }) => apiPage<MediaItem>("/dashboard/media", { query: { q: search, page: pageParam, per_page: PAGE_SIZE }, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  });
}

/** Resolve stored media ids to items (preserving the given order). */
export function useMediaByIds(ids: Array<number | null | undefined>) {
  const clean = ids.filter((id): id is number => typeof id === "number" && id > 0);
  const query = useQuery({
    queryKey: mediaKeys.byIds(clean),
    queryFn: ({ signal }) => apiPage<MediaItem>("/dashboard/media", { query: { ids: clean.join(","), per_page: 100 }, signal }),
    enabled: clean.length > 0,
    staleTime: 5 * 60_000,
  });
  const byId = new Map((query.data?.data ?? []).map((item) => [item.id, item]));
  return { ...query, items: clean.map((id) => byId.get(id)).filter((item): item is MediaItem => Boolean(item)), byId };
}

export type UploadItem = {
  key: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  media?: MediaItem;
};

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const PARALLEL = 3;

/**
 * Uploads files one request each (so every file has its own progress and error),
 * three at a time.
 */
export function useUploader({ purpose = "general", onUploaded }: { purpose?: "general" | "favicon"; onUploaded?: (items: MediaItem[]) => void } = {}) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const counter = useRef(0);

  const patch = useCallback((key: string, value: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...value } : item)));
  }, []);

  const uploadOne = useCallback(
    async (item: UploadItem): Promise<MediaItem | null> => {
      patch(item.key, { status: "uploading", progress: 0 });
      const form = new FormData();
      form.append("files[]", item.file);
      form.append("purpose", purpose);
      try {
        const [media] = await apiUpload<MediaItem[]>("/dashboard/media", form, (progress) => patch(item.key, { progress }));
        patch(item.key, { status: "done", progress: 100, media });
        return media ?? null;
      } catch (error) {
        const fieldMessage = isApiError(error) ? (error.errors["files.0"]?.[0] ?? error.errors.files?.[0]) : undefined;
        patch(item.key, { status: "error", error: fieldMessage ?? errorMessage(error) });
        return null;
      }
    },
    [patch, purpose],
  );

  const add = useCallback(
    async (files: FileList | File[]) => {
      const batch: UploadItem[] = Array.from(files).map((file) => {
        counter.current += 1;
        const localError = !ACCEPTED.includes(file.type)
          ? "invalid_type"
          : file.size > MAX_BYTES
            ? "too_large"
            : undefined;
        return {
          key: `${Date.now()}-${counter.current}`,
          file,
          progress: 0,
          status: localError ? "error" : "queued",
          error: localError,
        };
      });
      setItems((current) => [...batch, ...current]);

      const queue = batch.filter((item) => item.status === "queued");
      const uploaded: MediaItem[] = [];
      let cursor = 0;
      const worker = async () => {
        while (cursor < queue.length) {
          const item = queue[cursor++];
          const media = await uploadOne(item);
          if (media) uploaded.push(media);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));

      if (uploaded.length) {
        await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
        onUploaded?.(uploaded);
      }
      return uploaded;
    },
    [onUploaded, queryClient, uploadOne],
  );

  const clearFinished = useCallback(() => setItems((current) => current.filter((item) => item.status === "uploading" || item.status === "queued")), []);

  return { items, add, clearFinished, busy: items.some((item) => item.status === "uploading" || item.status === "queued") };
}

export async function updateMediaAlt(id: number, alt: string | null): Promise<MediaItem> {
  return api<MediaItem>(`/dashboard/media/${id}`, { method: "PATCH", body: { alt } });
}

export async function deleteMedia(id: number): Promise<void> {
  await api<void>(`/dashboard/media/${id}`, { method: "DELETE" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
