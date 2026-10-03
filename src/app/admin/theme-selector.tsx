"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { THEMES, type ThemeId } from "@/features/themes/constants";
import { updateTheme } from "./actions";

export function ThemeSelector({ selected }: { selected: ThemeId }) {
  const [state, action, pending] = useActionState(updateTheme, {});

  return (
    <form action={action} className="flex flex-col gap-3 border border-[var(--border)] bg-[var(--panel)] p-4">
      <label htmlFor="theme" className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
        Dashboard theme
      </label>
      <select key={selected} id="theme" name="theme" defaultValue={selected} disabled={pending}
        className="border border-[var(--border)] bg-[var(--panel-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]">
        {THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
      </select>
      <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        {THEMES.map((theme) => (
          <span key={theme.id} className="flex items-center gap-1.5">
            <span className="flex" aria-hidden>
              {theme.colors.map((color) => <span key={color} className="h-3 w-3" style={{ backgroundColor: color }} />)}
            </span>
            {theme.name}
          </span>
        ))}
      </div>
      <p className="text-xs text-[var(--muted)]">Applies to all displays on their next refresh or page load.</p>
      {state.error && <p role="alert" className="text-sm text-[var(--warning)]">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-[var(--accent)]">Theme saved.</p>}
      <Button type="submit" variant="accent" disabled={pending}>{pending ? "Saving…" : "Save theme"}</Button>
    </form>
  );
}
