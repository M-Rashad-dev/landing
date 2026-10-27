"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiPage } from "@/lib/api/client";

export type DomainStatus = "pending" | "active" | "failed";
export type SslStatus = "pending" | "issued" | "unknown";

export type DnsInstructions = {
  kind: "root" | "subdomain";
  zone: string;
  record: { type: "A" | "CNAME"; name: string; value: string };
  cloudflare_warning: string;
};

export type Domain = {
  id: number;
  host: string;
  type: "subdomain" | "custom";
  status: DomainStatus;
  is_primary: boolean;
  verified_at: string | null;
  check_attempts: number;
  last_checked_at: string | null;
  last_check_error: string | null;
  ssl_status: SslStatus;
  ssl_checked_at: string | null;
  created_at: string | null;
  instructions: DnsInstructions | null;
};

export type DomainsMeta = { platform_domain: string; custom_limit: number };

export type Availability = { label: string; host: string; available: boolean; reason: string | null };

export const domainKeys = { all: ["domains"] as const };

export function useDomains() {
  return useQuery({
    queryKey: domainKeys.all,
    queryFn: async () => {
      const page = await apiPage<Domain>("/dashboard/domains");
      return { domains: page.data, meta: page.meta as unknown as DomainsMeta };
    },
  });
}

export const addCustomDomain = (host: string) => api<Domain>("/dashboard/domains/custom", { method: "POST", body: { host } });
export const verifyDomain = (id: number) => api<Domain>(`/dashboard/domains/${id}/verify`, { method: "POST" });
export const checkDomainSsl = (id: number) => api<Domain>(`/dashboard/domains/${id}/check-ssl`, { method: "POST" });
export const makeDomainPrimary = (id: number) => api<Domain>(`/dashboard/domains/${id}/make-primary`, { method: "POST" });
export const deleteDomain = (id: number) => api<void>(`/dashboard/domains/${id}`, { method: "DELETE" });
export const renameSubdomain = (label: string) => api<Domain>("/dashboard/domains/subdomain", { method: "PUT", body: { label } });
export const subdomainAvailability = (label: string, signal?: AbortSignal) =>
  api<Availability>("/dashboard/domains/subdomain/availability", { query: { label }, signal });

/**
 * Live preview of what the server will store (mirror of DomainRules::normalize):
 * lowercase, no scheme / path / port / trailing dot, Unicode names → punycode.
 */
export function normalizeHost(input: string): string {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  host = host.replace(/[/?#\\][\s\S]*$/, "");
  if (host.includes("@")) host = host.slice(host.lastIndexOf("@") + 1);
  host = host.replace(/:\d*$/, "").trim().replace(/\.+$/, "");
  if (/[^\x20-\x7e]/.test(host)) {
    try {
      host = new URL(`http://${host}`).hostname;
    } catch {
      // Left as typed; the server answers with a clear error.
    }
  }
  return host;
}

/** "a.b.platform.com" style labels: 3–30 of a-z0-9 and inner dashes (SubdomainGenerator::isValidLabel). */
export function isValidLabel(label: string): boolean {
  return /^(?=.{3,30}$)[a-z0-9]+(-[a-z0-9]+)*$/.test(label);
}

/** The free subdomain's label: "rashad-4821.platform.com" → "rashad-4821". */
export function labelOf(host: string, platformDomain: string): string {
  return host.endsWith(`.${platformDomain}`) ? host.slice(0, -platformDomain.length - 1) : host;
}
