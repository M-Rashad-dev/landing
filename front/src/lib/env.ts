import "server-only";

/**
 * Runtime configuration. Read from process.env on every call so the same
 * build works on any domain (nothing is baked in at build time).
 */
export function serverEnv() {
  return {
    platformDomain: (process.env.PLATFORM_DOMAIN ?? "localhost").toLowerCase(),
    appHost: (process.env.APP_HOST ?? "app.localhost").toLowerCase(),
    laravelUrl: (process.env.LARAVEL_INTERNAL_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, ""),
    internalApiKey: process.env.INTERNAL_API_KEY ?? "",
    revalidateSecret: process.env.REVALIDATE_SECRET ?? "",
    isProduction: process.env.NODE_ENV === "production",
  };
}
