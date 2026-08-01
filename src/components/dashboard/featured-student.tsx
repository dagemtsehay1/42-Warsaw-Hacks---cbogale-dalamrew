import type { ReactNode } from "react";
import { StudentAvatar } from "@/components/ui/student-avatar";
import type { PresenceStudent } from "@/types/campus";

/**
 * The shared "one person, front and centre" card used for the campus honours on
 * the Presence screen. Both honours render identically so neither reads as the
 * lesser one; only the icon, headline value, and caption differ.
 */
export function FeaturedStudent({
  icon,
  title,
  student,
  value,
  caption,
  note,
  emptyMessage,
}: {
  icon?: ReactNode;
  title: string;
  student: PresenceStudent | null;
  value: ReactNode;
  caption?: string;
  note?: string;
  emptyMessage: string;
}) {
  return (
    <section className="flex min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)] p-6">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
          {title}
        </h2>
      </div>

      {student ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <StudentAvatar
            src={student.imageUrl}
            alt={student.login}
            size={120}
            className="ring-2 ring-[var(--accent)]"
          />
          <div>
            <div className="text-3xl font-semibold tracking-tight md:text-4xl">
              {student.login}
            </div>
            <div className="mt-2 font-mono text-3xl text-[var(--accent)]">
              {value}
            </div>
            {caption ? (
              <div className="mt-2 text-sm text-[var(--muted)]">{caption}</div>
            ) : null}
            {note ? (
              <div className="mt-1 text-sm text-[var(--muted)]">{note}</div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">{emptyMessage}</p>
      )}
    </section>
  );
}
