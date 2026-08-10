import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, LogOut, Trash2 } from "lucide-react";
import { removeSlide, toggleSlide } from "./actions";
import { UploadForm } from "./upload-form";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/current-user";
import { canSignIn } from "@/lib/api/42/oauth";
import { hasDatabase, migrate } from "@/lib/db/pool";
import { listAllSlides } from "@/features/slides/repository";
import { formatLongDate } from "@/lib/utils/format";

export const metadata = { title: "Slides · 42 Warsaw" };
export const dynamic = "force-dynamic";

/**
 * Bocal's page for putting posters into the board rotation.
 *
 * Access is the `staff?` flag off `/v2/me` — no separate password to share,
 * rotate or leak, and it tracks staffing changes on its own.
 */
export default async function AdminPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <Shell>
        <p className="text-sm text-[var(--muted)]">
          Sign in with a 42 staff account to manage the board&apos;s slides.
        </p>
        {(await canSignIn()) ? (
          <Link href="/api/auth/login?returnTo=/admin">
            <Button variant="accent" size="lg">
              Sign in with 42
            </Button>
          </Link>
        ) : (
          <p className="text-sm text-[var(--warning)]">
            <code>APP_PUBLIC_URL</code> is not set, so login is unavailable.
          </p>
        )}
      </Shell>
    );
  }

  if (!user.isStaff) {
    return (
      <Shell>
        <p className="text-sm text-[var(--warning)]">
          This page is for bocal only. You are signed in as{" "}
          <strong>{user.login}</strong>, which is not a staff account.
        </p>
        <form action="/api/auth/logout?returnTo=/admin" method="post">
          <Button variant="outline">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </Shell>
    );
  }

  if (!hasDatabase()) {
    return (
      <Shell>
        <p className="text-sm text-[var(--warning)]">
          Slides need a database and this server has none configured.
        </p>
      </Shell>
    );
  }

  await migrate();
  const slides = await listAllSlides();

  return (
    <Shell login={user.login}>
      <UploadForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
          Slides ({slides.length})
        </h2>

        {slides.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No slides yet. Anything you upload appears as an extra screen in the
            board rotation.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {slides.map((slide) => (
              <li
                key={slide.id}
                className="flex flex-col gap-2 border border-[var(--border)] bg-[var(--panel)] p-3"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-[var(--panel-elevated)]">
                  <Image
                    src={`/api/slides/${slide.id}/image`}
                    alt={slide.title}
                    fill
                    unoptimized
                    className={`object-contain ${slide.active ? "" : "opacity-40"}`}
                  />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {slide.title}
                  </div>
                  <div className="truncate text-xs text-[var(--muted)]">
                    {slide.uploadedBy} · {formatLongDate(new Date(slide.createdAt))} ·{" "}
                    {(slide.byteSize / 1024).toFixed(0)}KB
                  </div>
                </div>

                <div className="flex gap-2">
                  <form action={toggleSlide} className="flex-1">
                    <input type="hidden" name="id" value={slide.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={String(!slide.active)}
                    />
                    <Button variant="outline" size="sm" className="w-full">
                      {slide.active ? (
                        <>
                          <EyeOff className="h-4 w-4" /> Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" /> Show
                        </>
                      )}
                    </Button>
                  </form>

                  <form action={removeSlide}>
                    <input type="hidden" name="id" value={slide.id} />
                    <Button variant="ghost" size="sm" aria-label="Delete slide">
                      <Trash2 className="h-4 w-4 text-[var(--warning)]" />
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Shell({
  children,
  login,
}: {
  children: React.ReactNode;
  login?: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-5 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board slides</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Images here become extra screens in the Social Space rotation.
          </p>
        </div>
        {login && (
          <form action="/api/auth/logout?returnTo=/admin" method="post">
            <Button variant="ghost" size="sm" aria-label={`Sign out ${login}`}>
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        )}
      </header>

      {children}

      <footer className="mt-auto pt-6 text-xs text-[var(--muted)]">
        <Link href="/dashboard" className="underline">
          Back to the dashboard
        </Link>
      </footer>
    </main>
  );
}
