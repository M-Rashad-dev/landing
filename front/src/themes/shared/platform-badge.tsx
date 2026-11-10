import { siteMessages } from "@/messages/site";

/** "Made with …" line at the very bottom of a public page, for plans that keep it. Plain text colors from the identity. */
export function PlatformBadge({ platformDomain }: { platformDomain: string }) {
  const local = platformDomain === "localhost" || platformDomain.endsWith(".localhost") || platformDomain.endsWith(".localtest.me");
  return (
    <p className="py-4 text-center text-xs" style={{ color: "var(--c-muted)" }}>
      {siteMessages.branding.madeWith}{" "}
      <a href={`${local ? "http" : "https"}://${platformDomain}`} target="_blank" rel="noopener" className="font-semibold underline-offset-2 hover:underline">
        {siteMessages.branding.platform}
      </a>
    </p>
  );
}
