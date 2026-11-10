"use client";

import { announcePlanBlock, isPlanErrorCode } from "@/lib/billing/events";
import type { PlanBlock } from "@/lib/billing/types";
import { ApiError, type ApiErrorBody } from "./errors";

export type Paginated<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; [key: string]: unknown };
};

type ClientInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: ClientInit["query"]): string {
  const url = `/api/bff${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request(path: string, init: ClientInit = {}): Promise<Response> {
  const { method = "GET", body, query, signal } = init;
  const headers: Record<string, string> = { Accept: "application/json" };
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), { method, headers, body: payload, signal, credentials: "same-origin" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, {});
  }

  if (response.status === 401 && typeof window !== "undefined") {
    // Full reload on purpose: the BFF already cleared the stale cookie.
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(new URL(`/login?next=${next}`, window.location.origin).toString());
  }

  return response;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const json = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (!response.ok) {
    // Plan limits / locked features / expired plan: one upgrade dialog instead of a bare error toast.
    if (response.status === 403 && isPlanErrorCode(json.code)) announcePlanBlock(json as PlanBlock);
    throw new ApiError(response.status, json);
  }
  return json as T;
}

/** Calls the dashboard BFF and returns the `data` of the envelope. */
export async function api<T>(path: string, init: ClientInit = {}): Promise<T> {
  const json = await parse<{ data: T }>(await request(path, init));
  return json?.data as T;
}

/** Same as api() but returns the whole envelope (data + meta) for lists. */
export async function apiPage<T>(path: string, init: ClientInit = {}): Promise<Paginated<T>> {
  return parse<Paginated<T>>(await request(path, init));
}

/** Raw response for downloads (CSV export). */
export async function apiRaw(path: string, init: ClientInit = {}): Promise<Response> {
  const response = await request(path, init);
  if (!response.ok) await parse(response);
  return response;
}

/** Upload with progress (fetch has no upload progress). */
export function apiUpload<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(path));
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError(0, {}));
    xhr.onload = () => {
      let json: ApiErrorBody & { data?: T } = {};
      try {
        json = JSON.parse(xhr.responseText || "{}");
      } catch {
        json = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(json.data as T);
      else reject(new ApiError(xhr.status, json));
    };
    xhr.send(form);
  });
}
