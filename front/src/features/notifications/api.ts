import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import * as React from "react";
import { api } from "@/lib/api/client";
import { useRealtime } from "@/lib/realtime/realtime";

export type BellArea = "dashboard" | "admin";
export type BellItem = { id: number; event: string; title: string; body: string; link: string | null; read: boolean; created_at: string };
export type BellPage = { items: BellItem[]; has_more: boolean; unread: number };
export type NotifyChannel = "whatsapp" | "email";

export const bellKey = (area: BellArea) => ["bell", area] as const;

/** The signed-in user's bell, newest first, 20 at a time (older ones on demand). */
export function useBell(area: BellArea) {
  return useInfiniteQuery({
    queryKey: bellKey(area),
    queryFn: ({ pageParam }) => api<BellPage>(`/${area}/notifications`, { query: { before: pageParam ?? null } }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => (last.has_more ? (last.items.at(-1)?.id ?? null) : null),
    refetchOnWindowFocus: true,
  });
}

/** New notifications arrive live on the user's own channel; returns false while realtime is off. */
export function useBellLive(area: BellArea, userId: number, onNew: (item: BellItem) => void) {
  const client = useQueryClient();
  const onNewRef = React.useRef(onNew);
  React.useEffect(() => {
    onNewRef.current = onNew;
  });

  return useRealtime<{ notification: BellItem }>(
    `user.${userId}`,
    "notification.created",
    ({ notification }) => {
      client.setQueryData<InfiniteData<BellPage, number | null>>(bellKey(area), (old) => {
        if (!old || old.pages.length === 0) return old;
        const [first, ...rest] = old.pages;
        if (first.items.some((n) => n.id === notification.id)) return old;
        return { ...old, pages: [{ ...first, items: [notification, ...first.items], unread: first.unread + 1 }, ...rest] };
      });
      onNewRef.current(notification);
    },
    () => void client.invalidateQueries({ queryKey: bellKey(area) }),
  );
}

export const markRead = (area: BellArea, id: number) => api<void>(`/${area}/notifications/${id}/read`, { method: "POST" });
export const markAllRead = (area: BellArea) => api<void>(`/${area}/notifications/read`, { method: "POST" });

export const getChannel = () => api<{ channel: NotifyChannel }>("/dashboard/profile/notifications");
export const saveChannel = (channel: NotifyChannel) => api<{ channel: NotifyChannel }>("/dashboard/profile/notifications", { method: "PUT", body: { channel } });
