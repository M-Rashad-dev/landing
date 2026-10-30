/** What a merchant's video link points to; anything else is not embedded. */
export type VideoSource = { kind: "youtube"; id: string } | { kind: "vimeo"; id: string } | { kind: "file"; url: string };

/**
 * Accepts YouTube (watch, youtu.be, shorts, embed), Vimeo and direct https .mp4 / .webm links.
 * Embeds always use the privacy-friendly hosts (youtube-nocookie, player.vimeo.com).
 */
export function parseVideoUrl(raw: string | null | undefined): VideoSource | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") return youtube(url.pathname.slice(1));
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") return youtube(url.searchParams.get("v"));
    const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
    return match ? youtube(match[1]) : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/(\d{6,12})/);
    return match ? { kind: "vimeo", id: match[1] } : null;
  }
  if (/\.(mp4|webm)$/i.test(url.pathname)) return { kind: "file", url: url.toString() };
  return null;
}

function youtube(id: string | null | undefined): VideoSource | null {
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { kind: "youtube", id } : null;
}

export function embedUrl(source: Exclude<VideoSource, { kind: "file" }>): string {
  return source.kind === "youtube" ? `https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&rel=0&playsinline=1` : `https://player.vimeo.com/video/${source.id}?autoplay=1`;
}

/** Poster shown before play when the merchant picked no image (YouTube only). */
export function posterUrl(source: VideoSource): string | null {
  return source.kind === "youtube" ? `https://i.ytimg.com/vi/${source.id}/hqdefault.jpg` : null;
}
