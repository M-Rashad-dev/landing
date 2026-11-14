import ReactMarkdown from "react-markdown";

/**
 * A platform page's Markdown, styled for reading. Raw HTML in the text is never rendered
 * (react-markdown escapes it), so the admin's text cannot inject scripts.
 * "## " section headings get ids s1, s2… in order, the same as pageHeadings() (the table of contents).
 */
export function Prose({ body }: { body: string }) {
  const ids = new Map<number, string>();
  body.split("\n").forEach((line, i) => {
    if (/^##\s+/.test(line)) ids.set(i + 1, `s${ids.size + 1}`);
  });

  return (
    <div className="mk-prose">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          h2: ({ node, children }) => <h2 id={ids.get(node?.position?.start.line ?? 0)}>{children}</h2>,
          a: ({ href, children }) => {
            const external = typeof href === "string" && /^https?:\/\//.test(href);
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
          img: () => null,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
