import Link from "next/link";
import { LogOut, Plus, Check, AlertCircle } from "lucide-react";
import { addListing, removeListing } from "./actions";
import { Button } from "@/components/ui/button";
import { StudentAvatar } from "@/components/ui/student-avatar";
import { currentUser } from "@/lib/auth/current-user";
import { canSignIn } from "@/lib/api/42/oauth";
import { hasDatabase, migrate } from "@/lib/db/pool";
import { projectOptionsFor } from "@/features/teammates/service";
import { TEAMMATE_TTL_DAYS } from "@/features/teammates/repository";
import type { TeammateProjectOption } from "@/types/campus";

export const metadata = { title: "Find a teammate · 42 Warsaw" };
export const dynamic = "force-dynamic";

/**
 * The page behind the QR code. It is the only part of this project designed for
 * a phone held at arm's length rather than a TV across a room, so everything is
 * one column and every tap target is full-width.
 */
export default async function TeammatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await currentUser();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Find a teammate
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Put your name on the Social Space screen for a project you want to
          pair up on.
        </p>
      </header>

      {error && <ErrorNote reason={error} />}

      {!user ? <SignedOut /> : <SignedIn user={user} />}

      <footer className="mt-auto pt-6 text-xs text-[var(--muted)]">
        <Link href="/dashboard" className="underline">
          Back to the dashboard
        </Link>
      </footer>
    </main>
  );
}

function ErrorNote({ reason }: { reason: string }) {
  const message =
    reason === "declined"
      ? "You cancelled the 42 login — nothing was saved."
      : reason === "state"
        ? "That login link expired. Please scan the code again."
        : "Something went wrong signing you in. Please try again.";

  return (
    <div className="flex items-start gap-2 border border-[var(--warning)] bg-[var(--panel)] p-3 text-sm text-[var(--warning)]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

async function SignedOut() {
  if (!(await canSignIn())) {
    return (
      <p className="border border-[var(--border)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
        Login is not configured on this server yet (<code>APP_PUBLIC_URL</code>{" "}
        is unset).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">
        Sign in with your 42 account so we know which projects are yours. We only
        read your profile and your in-progress projects.
      </p>
      <Link href="/api/auth/login?returnTo=/teammate">
        <Button variant="accent" size="lg" className="w-full">
          Sign in with 42
        </Button>
      </Link>
    </div>
  );
}

async function SignedIn({
  user,
}: {
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>;
}) {
  if (!hasDatabase()) {
    return (
      <p className="border border-[var(--border)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
        The teammate board needs a database and this server has none configured.
      </p>
    );
  }

  await migrate();

  let options: TeammateProjectOption[] = [];
  let loadError: string | null = null;
  try {
    options = await projectOptionsFor(user);
  } catch (e) {
    console.error("[teammate] could not load projects:", e);
    loadError = "We couldn't reach 42 to load your projects. Try again shortly.";
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 border border-[var(--border)] bg-[var(--panel)] p-3">
        <StudentAvatar src={user.imageUrl} alt={user.displayName} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{user.displayName}</div>
          <div className="truncate text-xs text-[var(--muted)]">
            {user.login}
          </div>
        </div>
        <form action="/api/auth/logout?returnTo=/teammate" method="post">
          <Button variant="ghost" size="sm" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {loadError ? (
        <p className="text-sm text-[var(--warning)]">{loadError}</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          You have no projects in progress right now, so there is nothing to
          list. Register for a project on intra and scan the code again.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {options.map((option) => (
              <ProjectRow key={option.projectId} option={option} />
            ))}
          </ul>
          <p className="text-xs text-[var(--muted)]">
            Listings drop off the screen automatically after{" "}
            {TEAMMATE_TTL_DAYS} days. Scan the code again any time to add or
            remove one.
          </p>
        </>
      )}
    </div>
  );
}

function ProjectRow({ option }: { option: TeammateProjectOption }) {
  return (
    <li>
      <form action={option.listed ? removeListing : addListing}>
        <input type="hidden" name="projectId" value={option.projectId} />
        <input type="hidden" name="projectName" value={option.projectName} />
        <input type="hidden" name="projectSlug" value={option.projectSlug} />
        <button
          type="submit"
          className={`flex w-full items-center justify-between gap-3 border p-4 text-left transition-colors ${
            option.listed
              ? "border-[var(--accent)] bg-[var(--panel-elevated)]"
              : "border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-hover)]"
          }`}
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {option.projectName}
            </span>
            <span className="block truncate text-xs text-[var(--muted)]">
              {option.listed ? "On the screen — tap to remove" : "Tap to add"}
            </span>
          </span>
          {option.listed ? (
            <Check className="h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden />
          ) : (
            <Plus className="h-5 w-5 shrink-0 text-[var(--muted)]" aria-hidden />
          )}
        </button>
      </form>
    </li>
  );
}
