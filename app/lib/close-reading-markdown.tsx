"use client";

import { Fragment, type ReactNode } from "react";

type MarkdownBlock = { type: "paragraph"; text: string } | { type: "list"; ordered: boolean; items: string[] };
export type MarkdownSection = { title: string; blocks: MarkdownBlock[] };

const headingPattern = /^#{1,6}\s*(.+)$/;
const bulletPattern = /^(?:[-*•]\s+|\d+[.)]\s+)(.+)$/;

export function parseCloseReadingMarkdown(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection = { title: "", blocks: [] };
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (list) { current.blocks.push({ type: "list", ordered: list.ordered, items: list.items }); list = null; }
  };
  const flushSection = () => {
    flushList();
    if (current.title || current.blocks.length) sections.push(current);
  };

  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flushList(); continue; }
    const heading = line.match(headingPattern);
    if (heading) { flushSection(); current = { title: heading[1].trim(), blocks: [] }; continue; }
    const bullet = line.match(bulletPattern);
    if (bullet) {
      const ordered = /^\d+[.)]/.test(line);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(bullet[1].trim());
      continue;
    }
    flushList();
    current.blocks.push({ type: "paragraph", text: line });
  }
  flushSection();
  return sections;
}

function inlineNodes(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={index}>{part.slice(1, -1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export default function CloseReadingMarkdown({ markdown }: { markdown: string }) {
  const sections = parseCloseReadingMarkdown(markdown);
  return (
    <>
      {sections.map((section, sectionIndex) => (
        <div className="analysisSection" key={sectionIndex}>
          {section.title && <b>{section.title}</b>}
          {section.blocks.map((block, blockIndex) => block.type === "paragraph"
            ? <p key={blockIndex}>{inlineNodes(block.text)}</p>
            : <ol key={blockIndex}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineNodes(item)}</li>)}</ol>)}
        </div>
      ))}
    </>
  );
}
