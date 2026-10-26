import ReactMarkdown, { type Components } from "react-markdown";
import { safeHref } from "@/lib/links";

/**
 * Renders the simple Markdown used in product descriptions. Raw HTML is never
 * rendered (react-markdown escapes it) and links go through the URL allow-list.
 */
const components: Components = {
  a: ({ href, children }) => {
    const safe = safeHref(href ?? "");
    if (!safe) return <span>{children}</span>;
    const external = /^https?:/i.test(safe);
    return (
      <a href={safe} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>
        {children}
      </a>
    );
  },
  img: () => null,
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown components={components} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Plain text version (for meta descriptions / JSON-LD). */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_~`>#]+/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
