"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addComment } from "@/lib/actions/comments";

async function uploadImage(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

export function CommentEditor({
  taskId,
  onPosted,
}: {
  taskId: string;
  onPosted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    editorProps: {
      attributes: { class: "comment-editor min-h-[80px]" },
      handlePaste(_view, event) {
        const img = Array.from(event.clipboardData?.files ?? []).find((f) =>
          f.type.startsWith("image/"),
        );
        if (!img) return false;
        event.preventDefault();
        uploadImage(img).then((url) => {
          if (url) editor?.chain().focus().setImage({ src: url }).run();
        });
        return true;
      },
      handleDrop(_view, event) {
        const img = Array.from((event as DragEvent).dataTransfer?.files ?? []).find((f) =>
          f.type.startsWith("image/"),
        );
        if (!img) return false;
        event.preventDefault();
        uploadImage(img).then((url) => {
          if (url) editor?.chain().focus().setImage({ src: url }).run();
        });
        return true;
      },
    },
  });

  function pickImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await uploadImage(file);
      if (url) editor?.chain().focus().setImage({ src: url }).run();
    };
    input.click();
  }

  function setLink() {
    const url = window.prompt("Link URL (leave empty to remove)");
    if (url === null) return;
    if (url === "") editor?.chain().focus().unsetLink().run();
    else editor?.chain().focus().setLink({ href: url }).run();
  }

  function submit() {
    if (!editor) return;
    setError(null);
    const html = editor.getHTML();
    startTransition(async () => {
      const res = await addComment({ taskId, bodyHtml: html });
      if (res.error) {
        setError(res.error);
        return;
      }
      editor.commands.clearContent();
      if (onPosted) onPosted();
      else router.refresh();
    });
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
        <Btn onClick={pickImage}>
          <ImageIcon className="h-4 w-4" />
        </Btn>
      </div>

      <EditorContent editor={editor} className="px-3 py-2 text-sm text-ink" />

      <div className="flex items-center justify-between gap-2 border-t border-border p-2">
        <span className={cn("text-xs", error ? "text-negative" : "text-muted")}>
          {error ?? "Tip: paste or drop a screenshot to attach it."}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Posting…" : "Comment"}
        </button>
      </div>
    </div>
  );
}

function Btn({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-app hover:text-ink",
        active && "bg-app text-primary",
      )}
    >
      {children}
    </button>
  );
}
