"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadSlide, type UploadResult } from "./actions";
import { MAX_SLIDE_BYTES } from "@/features/slides/constants";

/**
 * The one client component on the admin page. It exists for `useActionState`:
 * an upload is the only place here where a person waits on the server and needs
 * to be told what happened.
 */
export function UploadForm() {
  const [state, action, pending] = useActionState<UploadResult, FormData>(
    uploadSlide,
    {},
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-3 border border-[var(--border)] bg-[var(--panel)] p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Title
        </label>
        <input
          id="title"
          name="title"
          placeholder="Defaults to the file name"
          className="border border-[var(--border)] bg-[var(--panel-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="image" className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Image
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          required
          className="border border-[var(--border)] bg-[var(--panel-elevated)] px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-[var(--panel-hover)] file:px-3 file:py-1 file:text-sm"
        />
        <p className="text-xs text-[var(--muted)]">
          PNG, JPEG, WebP or GIF, up to {MAX_SLIDE_BYTES / 1024 / 1024}MB.
          Landscape 16:9 fills the screen best.
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-[var(--warning)]">{state.error}</p>
      )}
      {state.ok && (
        <p className="text-sm text-[var(--accent)]">
          Uploaded. It joins the rotation on the next board refresh.
        </p>
      )}

      <Button type="submit" variant="accent" disabled={pending}>
        <Upload className="h-4 w-4" />
        {pending ? "Uploading…" : "Upload slide"}
      </Button>
    </form>
  );
}
