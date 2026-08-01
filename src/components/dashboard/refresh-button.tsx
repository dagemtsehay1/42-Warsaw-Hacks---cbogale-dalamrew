"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Re-renders the page from the stored snapshot. It does not trigger a 42 API
 * call — that is the ingest job's job — so it is safe to lean on.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => startTransition(() => router.refresh())}
      aria-label="Refresh dashboard"
    >
      <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
    </Button>
  );
}
