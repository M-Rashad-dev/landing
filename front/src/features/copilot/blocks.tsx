"use client";

import { ArrowUpLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import type { CopilotBlock } from "./api";

type HandoffBlock = Extract<CopilotBlock, { type: "handoff" }>;

function isHandoff(block: CopilotBlock): block is HandoffBlock {
  return block.type === "handoff" && typeof block.href === "string" && block.href.startsWith("/dashboard");
}

function Handoff({ block }: { block: HandoffBlock }) {
  return (
    <Button asChild size="sm" variant={block.target === "designer" ? "primary" : "outline"} className="self-start">
      <Link href={block.href}>
        {block.target === "designer" ? <Sparkles className="size-3.5" /> : <ArrowUpLeft className="size-3.5" />}
        {block.label}
      </Link>
    </Button>
  );
}

/**
 * One renderer per card type (the server builds the cards; the model never writes them). Each stage adds its types
 * here; an unknown type renders nothing.
 */
export function CopilotBlocks({ blocks }: { blocks: CopilotBlock[] }) {
  const nodes: React.ReactNode[] = [];
  blocks.forEach((block, i) => {
    if (isHandoff(block)) nodes.push(<Handoff key={i} block={block} />);
  });
  return nodes.length > 0 ? <div className="flex flex-col gap-2">{nodes}</div> : null;
}
