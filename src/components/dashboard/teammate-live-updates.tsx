"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import type { TeammateRequest } from "@/types/campus";

/** How often to check whether the teammate board changed. */
const POLL_MS = 6_000;

/** How long one toast stays up before it clears itself. */
const TOAST_MS = 8_000;

type Toast = {
  id: string;
  kind: "added" | "removed";
  login: string;
  projectName: string;
};

/**
 * Announces "looking for a teammate" listings on every open board, live.
 *
 * `addListing`/`removeListing` (`/teammate`'s server actions) call
 * `revalidatePath("/dashboard")`, but that only ever affects the request that
 * called it — it does nothing for a *different* browser (the wall display)
 * that already has the page open. So this polls the same data the board
 * itself renders, diffs it against the previous poll to find exactly who was
 * added or removed, and both toasts that (name + project, the same for
 * either direction) and refreshes the server-rendered list behind it.
 *
 * The first poll only establishes the baseline — nothing toasts for listings
 * that were already there when the board loaded.
 */
export function TeammateLiveUpdates() {
  const router = useRouter();
  const previous = useRef<Map<number, TeammateRequest> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let cancelled = false;

    function dismiss(id: string) {
      window.setTimeout(() => {
        if (!cancelled) setToasts((t) => t.filter((toast) => toast.id !== id));
      }, TOAST_MS);
    }

    async function poll() {
      try {
        const response = await fetch("/api/teammates/live", {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;

        const { requests } = (await response.json()) as {
          requests: TeammateRequest[];
        };
        const current = new Map(requests.map((r) => [r.id, r]));
        const prev = previous.current;
        previous.current = current;

        if (!prev) return; // Baseline only — nothing changed yet.

        const added = requests.filter((r) => !prev.has(r.id));
        const removed = [...prev.values()].filter((r) => !current.has(r.id));
        if (added.length === 0 && removed.length === 0) return;

        const stamp = Date.now();
        const newToasts: Toast[] = [
          ...added.map((r) => ({
            id: `add-${r.id}-${stamp}`,
            kind: "added" as const,
            login: r.login,
            projectName: r.projectName,
          })),
          ...removed.map((r) => ({
            id: `rm-${r.id}-${stamp}`,
            kind: "removed" as const,
            login: r.login,
            projectName: r.projectName,
          })),
        ];

        setToasts((t) => [...t, ...newToasts]);
        for (const toast of newToasts) dismiss(toast.id);

        // The toast is the notice; this is the update — it re-renders the
        // teammate section (and the rest of the board) with the new data.
        router.refresh();
      } catch {
        // A dropped poll just tries again next tick.
      }
    }

    poll();
    const interval = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router]);

  if (toasts.length === 0) return null;

  return (
    <div
      // Clears the header row (title, screen rotation, clock) rather than
      // racing it for the same strip of the screen.
      className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4 md:top-24"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="board-screen flex items-center gap-2 border bg-[var(--panel-elevated)] px-4 py-2.5 text-sm shadow-lg"
          style={{
            borderColor:
              toast.kind === "added" ? "var(--accent)" : "var(--warning)",
          }}
        >
          {toast.kind === "added" ? (
            <UserPlus
              className="h-4 w-4 shrink-0 text-[var(--accent)]"
              aria-hidden
            />
          ) : (
            <UserMinus
              className="h-4 w-4 shrink-0 text-[var(--warning)]"
              aria-hidden
            />
          )}
          <span>
            <strong>{toast.login}</strong>{" "}
            {toast.kind === "added"
              ? "is looking for a teammate on"
              : "is no longer looking for a teammate on"}{" "}
            <span className="font-mono text-[var(--accent)]">
              {toast.projectName}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
