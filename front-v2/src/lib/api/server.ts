import "server-only";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { TOKEN_COOKIE } from "@/lib/auth/cookie";
import { serverEnv } from "@/lib/env";
import { ApiError, type ApiErrorBody } from "./errors";

type ServerFetchInit = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Send the dashboard token from the cookie (default true). */
  auth?: boolean;
  /** Send X-Internal-Key (public endpoints). */
  internal?: boolean;
};

/** Raw call to Laravel from the server. Returns the Response untouched. */
export async function laravelFetch(path: string, init: ServerFetchInit = {}): Promise<Response> {
  const env = serverEnv();
  const { auth = true, internal = false, body, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");

  if (auth) {
    const token = (await cookies()).get(TOKEN_COOKIE)?.value;
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }
  if (internal) finalHeaders.set("X-Internal-Key", env.internalApiKey);

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (body instanceof FormData || typeof body === "string") {
      payload = body as BodyInit;
    } else {
      finalHeaders.set("Content-Type", "application/json");
      payload = JSON.stringify(body);
    }
  }

  return fetch(`${env.laravelUrl}/api/v1${path}`, {
    cache: "no-store",
    ...rest,
    headers: finalHeaders,
    body: payload,
  });
}

/** JSON call to Laravel; throws ApiError on non-2xx. Returns `data` of the envelope. */
export async function serverApi<T>(path: string, init: ServerFetchInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await laravelFetch(path, init);
  } catch (error) {
    // Let Next's own control-flow errors (dynamic usage, redirects) through.
    unstable_rethrow(error);
    throw new ApiError(0, {});
  }

  if (response.status === 204) return undefined as T;

  const json = (await response.json().catch(() => ({}))) as ApiErrorBody & { data?: T };
  if (!response.ok) throw new ApiError(response.status, json);

  return json.data as T;
}
