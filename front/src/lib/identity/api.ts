"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";
import type { Identity } from "@/lib/types";

export const identityKeys = {
  all: ["identities"] as const,
  list: () => ["identities", "list"] as const,
  detail: (id: number) => ["identities", id] as const,
};

export function useIdentities() {
  return useQuery({
    queryKey: identityKeys.list(),
    queryFn: ({ signal }) => apiPage<Identity>("/dashboard/identities", { query: { per_page: 100 }, signal }),
  });
}

export function useIdentity(id: number | null) {
  return useQuery({
    queryKey: identityKeys.detail(id ?? 0),
    queryFn: ({ signal }) => api<Identity>(`/dashboard/identities/${id}`, { signal }),
    enabled: id !== null,
  });
}

export type IdentityPayload = Omit<Identity, "id" | "is_default" | "logo" | "favicon" | "og_image" | "created_at" | "updated_at">;

export function saveIdentity(payload: IdentityPayload, id?: number): Promise<Identity> {
  return id
    ? api<Identity>(`/dashboard/identities/${id}`, { method: "PUT", body: payload })
    : api<Identity>("/dashboard/identities", { method: "POST", body: payload });
}

export function makeIdentityDefault(id: number): Promise<Identity> {
  return api<Identity>(`/dashboard/identities/${id}/make-default`, { method: "POST" });
}

export function deleteIdentity(id: number): Promise<void> {
  return api<void>(`/dashboard/identities/${id}`, { method: "DELETE" });
}
