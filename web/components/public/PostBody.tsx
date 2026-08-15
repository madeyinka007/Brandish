import { Fragment } from "react";

// Renders a post's stored Tiptap JSON (posts.body) as the styled article body from the design:
// 17/1.75 ink-700 measure, serif H2/H3, accent links, bullet/number lists, pull-quotes, figures.
// Server component — no interactivity.

interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}
interface Node {
  type?: string;
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, unknown>;
  content?: Node[];
}

function withMarks(text: string, marks: Mark[] | undefined, key: number): React.ReactNode {
  let el: React.ReactNode = text;
  for (const m of marks ?? []) {
    if (m.type === "bold") el = <strong className="font-bold text-ink-900">{el}</strong>;
    else if (m.type === "italic") el = <em>{el}</em>;
    else if (m.type === "underline") el = <u>{el}</u>;
    else if (m.type === "strike") el = <s>{el}</s>;
    else if (m.type === "code") el = <code className="rounded bg-surface-alt px-1.5 py-0.5 text-[0.9em]">{el}</code>;
    else if (m.type === "link") {
      const href = (m.attrs?.href as string) || "#";
      const external = /^https?:\/\//.test(href);
      el = (
        <a
          href={href}
          className="text-accent transition-colors hover:text-accent-hover"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {el}
        </a>
      );
    }
  }
  return <Fragment key={key}>{el}</Fragment>;
}

/** Inline content (text nodes with marks) of a block. */
function inline(nodes: Node[] | undefined): React.ReactNode {
  if (!nodes) return null;
  return nodes.map((n, i) => (typeof n.text === "string" ? withMarks(n.text, n.marks, i) : block(n, i)));
}

function listItems(node: Node): React.ReactNode {
  return (node.content ?? []).map((li, i) => (
    <li key={i} className="pl-1.5">
      {(li.content ?? []).map((child, j) =>
        child.type === "paragraph" ? <Fragment key={j}>{inline(child.content)}</Fragment> : block(child, j),
      )}
    </li>
  ));
}

function block(node: Node, key: number): React.ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="text-[17px] leading-[1.75] text-ink-700">
          {inline(node.content)}
        </p>
      );
    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      const cls = "text-pretty font-serif font-bold text-ink-900";
      return level >= 3 ? (
        <h3 key={key} className={`${cls} text-[18px] leading-[1.35]`}>
          {inline(node.content)}
        </h3>
      ) : (
        <h2 key={key} className={`${cls} pt-2 text-[20px] leading-[1.3]`}>
          {inline(node.content)}
        </h2>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="flex list-disc flex-col gap-2 pl-6 text-[17px] leading-[1.75] text-ink-700 marker:text-ink-400">
          {listItems(node)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="flex list-decimal flex-col gap-2 pl-6 text-[17px] leading-[1.75] text-ink-700 marker:text-ink-400">
          {listItems(node)}
        </ol>
      );
    case "blockquote":
      return (
        <blockquote key={key} className="flex gap-5 py-2">
          <span className="font-serif text-[40px] font-bold leading-[0.8] text-accent" aria-hidden="true">
            “
          </span>
          <div className="flex flex-col gap-3">
            {(node.content ?? []).map((child, i) => (
              <div key={i} className="text-pretty font-serif text-[20px] font-bold leading-[1.5] text-ink-900 sm:text-[22px]">
                {child.type === "paragraph" ? inline(child.content) : block(child, i)}
              </div>
            ))}
          </div>
        </blockquote>
      );
    case "image": {
      const src = node.attrs?.src as string | undefined;
      const alt = (node.attrs?.alt as string) || "";
      const caption = (node.attrs?.title as string) || alt;
      if (!src) return null;
      return (
        <figure key={key} className="flex flex-col gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="w-full" />
          {caption ? (
            <figcaption className="text-center font-serif text-[12px] italic text-ink-400">{caption}</figcaption>
          ) : null}
        </figure>
      );
    }
    case "codeBlock":
      return (
        <pre key={key} className="overflow-x-auto rounded bg-ink-900 p-4 text-[14px] text-[#e2e8f0]">
          <code>{inline(node.content)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} className="border-line" />;
    case "hardBreak":
      return <br key={key} />;
    default:
      return node.content ? <Fragment key={key}>{node.content.map((c, i) => block(c, i))}</Fragment> : null;
  }
}

export default function PostBody({ body }: { body: unknown }) {
  const doc = body as Node | undefined;
  const nodes = doc?.content ?? [];
  if (nodes.length === 0) {
    return <p className="text-[17px] leading-[1.75] text-ink-500">This story has no content yet.</p>;
  }
  return <div className="flex flex-col gap-6">{nodes.map((n, i) => block(n, i))}</div>;
}
