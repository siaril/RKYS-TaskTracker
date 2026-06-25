"use client";

import { useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { createMentionExtension } from "@/components/editor/mention";
import { searchMentionables } from "@/lib/actions/mentions";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
  Image as ImageIcon,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UploadResult = {
  url?: string;
  filename?: string;
  isImage?: boolean;
  error?: string;
};

async function upload(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { error: data.error ?? "Upload failed." };
  }
  return (await res.json()) as UploadResult;
}

/** Reusable Tiptap editor (toolbar + content) used for comments and task
 *  descriptions. Reports HTML via onChange. With `withFileAttach`, non-image
 *  files paste/drop/pick as download links; otherwise only images are handled. */
export function RichTextEditor({
  initialHTML,
  onChange,
  withFileAttach = false,
  minHeightClass = "min-h-[80px]",
  onError,
  mention,
}: {
  initialHTML?: string;
  onChange: (html: string) => void;
  withFileAttach?: boolean;
  minHeightClass?: string;
  onError?: (message: string) => void;
  // When set, enables `@`-mention autocomplete of project members. Provide the
  // task (comments) or project (descriptions) the editor belongs to.
  mention?: { taskId?: string; projectId?: string };
}) {
  // Build the mention extension once per editor instance (the context is stable).
  const mentionExt = useMemo(() => {
    if (!mention) return null;
    return createMentionExtension((query) =>
      searchMentionables({ ...mention, query }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mention?.taskId, mention?.projectId]);

  const editor = useEditor({
    immediatelyRender: false,
    content: initialHTML ?? "",
    extensions: [
      StarterKit.configure({ link: false }),
      Image,
      Link.configure({ openOnClick: false, autolink: true }),
      ...(mentionExt ? [mentionExt] : []),
    ],
    editorProps: {
      attributes: { class: cn("comment-editor", minHeightClass) },
      handlePaste: (_v, e) => handleFiles(Array.from(e.clipboardData?.files ?? []), e),
      handleDrop: (_v, e) =>
        handleFiles(Array.from((e as DragEvent).dataTransfer?.files ?? []), e),
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  function insert(result: UploadResult) {
    if (result.error) {
      onError?.(result.error);
      return;
    }
    if (!result.url) return;
    if (result.isImage) {
      editor?.chain().focus().setImage({ src: result.url }).run();
    } else {
      // Download link: stored URL + original filename via ?name= for the download.
      const href = `${result.url}?name=${encodeURIComponent(result.filename ?? "file")}`;
      editor
        ?.chain()
        .focus()
        .insertContent(
          `<a href="${href}">📎 ${escapeHtml(result.filename ?? "attachment")}</a> `,
        )
        .run();
    }
  }

  // Returns true if it consumed the event (an acceptable file was found).
  function handleFiles(files: File[], event: Event): boolean {
    const file = files.find((f) => (withFileAttach ? true : f.type.startsWith("image/")));
    if (!file) return false;
    event.preventDefault();
    upload(file).then(insert);
    return true;
  }

  function pick(accept: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) insert(await upload(file));
    };
    input.click();
  }

  function setLink() {
    const url = window.prompt("Link URL (leave empty to remove)");
    if (url === null) return;
    if (url === "") editor?.chain().focus().unsetLink().run();
    else editor?.chain().focus().setLink({ href: url }).run();
  }

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-0.5 border-b border-border p-1.5">
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
          <Italic className="h-4 w-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}>
          <Strikethrough className="h-4 w-4" />
        </Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
          <List className="h-4 w-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={setLink} active={editor.isActive("link")}>
          <Link2 className="h-4 w-4" />
        </Btn>
        <Btn onClick={() => pick("image/*")}>
          <ImageIcon className="h-4 w-4" />
        </Btn>
        {withFileAttach && (
          <Btn onClick={() => pick("*/*")} title="Attach a file">
            <Paperclip className="h-4 w-4" />
          </Btn>
        )}
      </div>

      <EditorContent editor={editor} className="px-3 py-2 text-sm text-ink" />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function Btn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-app hover:text-ink",
        active && "bg-app text-primary",
      )}
    >
      {children}
    </button>
  );
}
