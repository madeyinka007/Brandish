"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import MediaPickerModal from "./MediaPickerModal";
import { ImageIcon, Link2 } from "./icons";

// Tiptap rich-text editor. Its getJSON() output IS the shape `posts.body` stores (see
// docs/data-model.md), so the body round-trips with no conversion. Inline images are picked
// from the media library.

function TB({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      disabled={disabled}
      className={`flex min-w-8 items-center justify-center rounded px-2 py-1 text-sm transition ${
        active ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-slate-100"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">
      <TB title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </TB>
      <TB title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </TB>
      <TB title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <u>U</u>
      </TB>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <TB title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </TB>
      <TB title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </TB>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <TB title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •
      </TB>
      <TB title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </TB>
      <TB title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        &ldquo;
      </TB>
      <TB title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        {"</>"}
      </TB>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <TB title="Link" active={editor.isActive("link")} onClick={setLink}>
        <Link2 width={15} height={15} />
      </TB>
      <TB title="Insert image from library" onClick={onImage}>
        <ImageIcon width={15} height={15} />
      </TB>
    </div>
  );
}

export default function RichTextEditor({
  initialContent,
  onChange,
  placeholder,
}: {
  initialContent?: unknown;
  onChange: (json: unknown) => void;
  placeholder?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false, // required for Next.js SSR (avoids hydration mismatch)
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "Write the post…" }),
    ],
    content: (initialContent as object) ?? "",
    editorProps: { attributes: { class: "tiptap-content" } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
      {editor ? <Toolbar editor={editor} onImage={() => setPickerOpen(true)} /> : <div className="h-10 border-b border-slate-200" />}
      <EditorContent editor={editor} className="px-3 py-2" />
      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => editor?.chain().focus().setImage({ src: url }).run()}
      />
    </div>
  );
}
