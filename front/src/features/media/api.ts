"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { apiPage, apiUpload } from "@/lib/api/client";
import { prepareImage } from "@/lib/media/compress";

export type MediaUrls = { thumb: string; medium: string; large: string };

export type MediaItem = {
  id: number;
  name: string;
  alt: string | null;
  width: number;
  height: number;
  urls: MediaUrls;
  size: number;
  created_at: string | null;
};

export const mediaKeys = { all: ["media"] as const, list: (q: string) => ["media", "list", q] as const };

const PER_PAGE = 24;

export function useMediaLibrary(q: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: mediaKeys.list(q),
    queryFn: ({ pageParam }) => apiPage<MediaItem>("/dashboard/media", { query: { q, page: pageParam, per_page: PER_PAGE } }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    enabled,
  });
}

/**
 * Compress then upload (the server takes up to 10 files per request). Files that cannot be
 * prepared are reported through onRejected and skipped; the rest still upload.
 */
export async function uploadImages(files: File[], { onPrepared, onRejected }: { onPrepared?: (done: number) => void; onRejected?: (error: unknown) => void } = {}): Promise<MediaItem[]> {
  const ready: File[] = [];
  let done = 0;
  for (const file of files) {
    try {
      ready.push(await prepareImage(file));
    } catch (error) {
      onRejected?.(error);
    }
    onPrepared?.(++done);
  }

  const uploaded: MediaItem[] = [];
  for (let i = 0; i < ready.length; i += 10) {
    const form = new FormData();
    for (const file of ready.slice(i, i + 10)) form.append("files[]", file, file.name);
    uploaded.push(...(await apiUpload<MediaItem[]>("/dashboard/media", form)));
  }
  return uploaded;
}

export function useRefreshMedia() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: mediaKeys.all });
}
