import { Users } from "lucide-react";
import { QrCode } from "@/components/dashboard/qr-code";
import { StudentAvatar } from "@/components/ui/student-avatar";
import type { TeammateRequest } from "@/types/campus";

/**
 * "Looking for a teammate", with the QR code that feeds it in the bottom right.
 *
 * The code sits next to the list rather than on its own panel deliberately: the
 * thing you scan and the thing scanning produces have to be in the same glance,
 * or nobody makes the connection walking past.
 */
export function TeammateBoard({
  requests,
  qrUrl,
}: {
  requests: TeammateRequest[];
  qrUrl: string | null;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col border border-[var(--border)] bg-[var(--panel)]">
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-6 py-4">
        <Users className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        <div>
          <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
            Looking for a teammate
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Scan to add yourself
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="min-h-0 flex-1 overflow-hidden">
          {requests.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-[var(--muted)]">
              Nobody is looking right now.
              <br />
              Scan the code to be the first.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="flex items-center gap-3 border border-[var(--border)] bg-[var(--panel-elevated)] p-2.5"
                >
                  <StudentAvatar
                    src={request.imageUrl}
                    alt={request.displayName}
                    size={44}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">
                      {request.displayName}
                    </div>
                    <div className="truncate font-mono text-xs text-[var(--accent)]">
                      {request.projectName}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center justify-end gap-2 self-end">
          {qrUrl ? (
            <>
              <QrCode value={qrUrl} size={150} className="bg-white p-2" />
              <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Scan to join
              </span>
            </>
          ) : (
            /* Never just disappear: a missing code looks like a broken board,
               and the reason is always the same one-line fix. */
            <div className="flex h-[150px] w-[150px] flex-col items-center justify-center border border-dashed border-[var(--border)] p-3 text-center">
              <span className="text-[10px] leading-snug text-[var(--muted)]">
                QR code needs
                <br />
                <code className="text-[var(--warning)]">APP_PUBLIC_URL</code>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
