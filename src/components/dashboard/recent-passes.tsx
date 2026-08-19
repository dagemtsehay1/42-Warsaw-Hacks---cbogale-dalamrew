import type { CSSProperties } from "react";
import { StudentAvatar } from "@/components/ui/student-avatar";
import type { ProjectPass } from "@/types/campus";
import { formatRelativeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** Two rows of ten. */
const COLUMNS = 10;
const ROWS = 2;

/**
 * Bubbles per burst, in two rings: a wide outer one that reaches almost to the
 * edge of the cell, and a tighter inner one on a shorter, quicker path so the
 * burst has depth rather than reading as a single expanding circle.
 */
const OUTER_BUBBLES = 22;
const INNER_BUBBLES = 12;

export function RecentPasses({ items }: { items: ProjectPass[] }) {
  if (!items.length) {
    return (
      <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
        <Heading count={0} />
        <p className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          No recent project validations in the latest fetch.
        </p>
      </section>
    );
  }

  const shown = items.slice(0, COLUMNS * ROWS);

  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <Heading count={shown.length} />
      {/* `auto-rows-fr` splits the panel evenly between the two rows, so the
          faces sit centred in their half instead of bunching under the header. */}
      <ul className="grid min-h-0 flex-1 auto-rows-fr grid-cols-5 place-items-center gap-x-3 gap-y-2 overflow-hidden px-4 py-2 lg:grid-cols-10">
        {shown.map((pass, index) => (
          <PassCard key={pass.id} pass={pass} index={index} />
        ))}
      </ul>
    </section>
  );
}

function PassCard({ pass, index }: { pass: ProjectPass; index: number }) {
  return (
    <li className="flex w-full min-w-0 flex-col items-center text-center">
      <div className="relative flex items-center justify-center">
        {/* Fireworks go behind the portrait, and only for an exam. */}
        {pass.isExam && <Fireworks index={index} />}

        <StudentAvatar
          src={pass.imageUrl}
          alt={pass.login}
          // Sized to the 10-wide column on a 1080p panel (~185px), leaving room
          // for the burst to open up without reaching into the next face.
          size={120}
          className={cn(
            "relative z-10 rounded-full ring-2",
            pass.isExam
              ? "ring-[var(--warning)] shadow-[0_0_24px_rgba(212,160,23,0.45)]"
              : "ring-[var(--accent)]",
          )}
        />

        <span
          className={cn(
            "absolute -bottom-2 z-20 rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums",
            pass.isExam
              ? "border-[var(--warning)] bg-[var(--panel)] text-[var(--warning)]"
              : "border-[var(--accent)] bg-[var(--panel)] text-[var(--accent)]",
          )}
        >
          {pass.score != null ? pass.score : "OK"}
        </span>
      </div>

      <div className="mt-4 w-full truncate text-base font-semibold md:text-lg">
        {pass.login}
      </div>
      <div className="w-full truncate text-xs text-[var(--muted)]">
        {pass.projectName}
      </div>
      {pass.markedAt ? (
        <div className="text-[11px] text-[var(--muted)]">
          {formatRelativeTime(pass.markedAt)}
        </div>
      ) : null}
    </li>
  );
}

/**
 * A pure-CSS burst: a glow plus two rings of bubbles, each rotated to its own
 * angle and thrown outwards on a loop. No canvas, no library, nothing to
 * hydrate — it renders on the server like the rest of the board.
 *
 * Bursts are staggered by card so the row doesn't pulse in unison, and the whole
 * thing stops under `prefers-reduced-motion` (see `globals.css`) — which is why
 * the gold ring and the gold mark carry the meaning too, not the animation.
 */
function Fireworks({ index }: { index: number }) {
  return (
    <span
      className="firework pointer-events-none absolute inset-0 z-0"
      style={{ "--burst-delay": `${(index % 5) * 0.45}s` } as CSSProperties}
      aria-hidden
    >
      <span className="firework-glow" />

      {Array.from({ length: OUTER_BUBBLES }).map((_, bubble) => (
        <span
          key={`outer-${bubble}`}
          className="firework-spark"
          style={
            {
              "--angle": `${(360 / OUTER_BUBBLES) * bubble}deg`,
              "--spark-delay": `${(bubble % 4) * 0.11}s`,
            } as CSSProperties
          }
        />
      ))}

      {/* Offset half a step so the inner ring sits between the outer bubbles. */}
      {Array.from({ length: INNER_BUBBLES }).map((_, bubble) => (
        <span
          key={`inner-${bubble}`}
          className="firework-spark firework-spark--inner"
          style={
            {
              "--angle": `${(360 / INNER_BUBBLES) * bubble + 360 / INNER_BUBBLES / 2}deg`,
              "--spark-delay": `${(bubble % 3) * 0.17 + 0.2}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

function Heading({ count }: { count: number }) {
  return (
    <header className="flex items-baseline justify-between border-b border-[var(--border)] px-4 py-3">
      <div>
        <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
          Recently Passed
        </h2>
        <p className="text-xs text-[var(--muted)]">
          One entry per student · exam ranks in gold
        </p>
      </div>
      {count > 0 && (
        <span className="font-mono text-sm text-[var(--accent)]">
          {count} wins
        </span>
      )}
    </header>
  );
}
