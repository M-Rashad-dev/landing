"use client";

import { ArrowUpLeft, Download, FileSpreadsheet, Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ar } from "@/messages/ar";
import { ChangeSetCard } from "./change-set-card";
import { type CopilotBlock, type CopilotChangeSetBlock, type CopilotExportBlock, type CopilotHandoffBlock, type CopilotTableBlock, buildCopilotExport, copilotExportUrl } from "./api";

const t = ar.copilot;

/** Rows a table shows before «عرض الكل». */
const PREVIEW_ROWS = 8;

function isHandoff(block: CopilotBlock): block is CopilotHandoffBlock {
  return block.type === "handoff" && typeof block.href === "string" && block.href.startsWith("/dashboard");
}

function isTable(block: CopilotBlock): block is CopilotTableBlock {
  return block.type === "table" && Array.isArray(block.columns) && Array.isArray(block.rows);
}

function isExport(block: CopilotBlock): block is CopilotExportBlock {
  return block.type === "export" && typeof block.token === "string";
}

function isChangeSet(block: CopilotBlock): block is CopilotChangeSetBlock {
  return block.type === "change_set" && typeof block.id === "number";
}

/** Only our own dashboard pages are links (the server builds them, this is a second guard). */
function safeHref(href: unknown): string | null {
  return typeof href === "string" && href.startsWith("/dashboard/") ? href : null;
}

function Handoff({ block }: { block: CopilotHandoffBlock }) {
  return (
    <Button asChild size="sm" variant={block.target === "designer" ? "primary" : "outline"} className="self-start">
      <Link href={block.href}>
        {block.target === "designer" ? <Sparkles className="size-3.5" /> : <ArrowUpLeft className="size-3.5" />}
        {block.label}
      </Link>
    </Button>
  );
}

function cell(kind: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "money") return formatMoney(value);
  return String(value);
}

function Table({ block }: { block: CopilotTableBlock }) {
  const [all, setAll] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [file, setFile] = React.useState<CopilotExportBlock | null>(null);
  const rows = all ? block.rows : block.rows.slice(0, PREVIEW_ROWS);
  const source = block.export;
  const link = safeHref(block.link);

  async function download() {
    if (!source) return;
    setBusy(true);
    try {
      const made = await buildCopilotExport(source, block.title);
      setFile(made);
      window.location.assign(copilotExportUrl(made.token));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-bold text-ink">{block.title}</p>
        <span className="shrink-0 text-[11px] text-ink-3">{t.table.rows(Math.min(block.rows.length, rows.length), block.total)}</span>
      </div>
      <div className="max-h-80 overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-max text-start text-[12px]">
          <thead className="sticky top-0 bg-surface-2 text-ink-2">
            <tr>
              {block.columns.map((c) => (
                <th key={c.key} scope="col" className="px-2.5 py-1.5 text-start font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const href = safeHref(row._url);
              return (
                <tr key={String(row.id ?? i)} className={cn("border-t border-border", href && "hover:bg-surface-2")}>
                  {block.columns.map((c, j) => (
                    <td key={c.key} className={cn("px-2.5 py-1.5 text-ink", (c.kind === "money" || c.kind === "int") && "tabular-nums")}>
                      {href && j === 0 ? (
                        <Link href={href} className="font-semibold text-brand-strong hover:underline">
                          {cell(c.kind, row[c.key])}
                        </Link>
                      ) : (
                        cell(c.kind, row[c.key])
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {block.rows.length > PREVIEW_ROWS ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>
            {all ? t.table.showLess : t.table.showAll}
          </Button>
        ) : null}
        {source ? (
          <Button type="button" size="sm" variant="outline" loading={busy} onClick={() => void download()}>
            <Download className="size-3.5" />
            {t.table.download}
          </Button>
        ) : null}
        {link ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={link}>
              <ArrowUpLeft className="size-3.5" />
              {t.table.openPage}
            </Link>
          </Button>
        ) : null}
        {file ? (
          <a href={copilotExportUrl(file.token)} className="text-[11px] font-semibold text-brand-strong hover:underline">
            {file.filename}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ExportFile({ block }: { block: CopilotExportBlock }) {
  return (
    <a
      href={copilotExportUrl(block.token)}
      className="flex items-center gap-3 self-start rounded-xl border border-border bg-surface px-3 py-2.5 transition hover:border-brand"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
        <FileSpreadsheet className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-ink">{block.filename}</span>
        <span className="block text-[11px] text-ink-3">{t.file.rows(block.rows)}</span>
      </span>
      <Download className="size-4 shrink-0 text-ink-3" aria-label={t.file.download} />
    </a>
  );
}

/**
 * One renderer per card type (the server builds the cards; the model never writes them). Each stage adds its types
 * here; an unknown type renders nothing. `repeated` = change cards already shown higher in the chat.
 */
export function CopilotBlocks({ blocks, repeated }: { blocks: CopilotBlock[]; repeated?: ReadonlySet<number> }) {
  const nodes: React.ReactNode[] = [];
  blocks.forEach((block, i) => {
    if (isHandoff(block)) nodes.push(<Handoff key={i} block={block} />);
    else if (isTable(block)) nodes.push(<Table key={i} block={block} />);
    else if (isExport(block)) nodes.push(<ExportFile key={i} block={block} />);
    else if (isChangeSet(block) && !repeated?.has(block.id)) nodes.push(<ChangeSetCard key={i} id={block.id} />);
  });
  return nodes.length > 0 ? <div className="flex min-w-0 flex-col gap-2">{nodes}</div> : null;
}
