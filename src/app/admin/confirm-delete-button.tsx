"use client";

import { Button } from "@/components/ui/button";

/**
 * A delete button that confirms before its form submits.
 *
 * The delete itself stays a plain server action (`<form action={...}>`); this
 * only needs to be a client component for the one thing that has to run in
 * the browser — `window.confirm` — so the rest of the admin page stays server
 * markup.
 */
export function ConfirmDeleteButton({
  confirmMessage,
  ...props
}: React.ComponentProps<typeof Button> & { confirmMessage: string }) {
  return (
    <Button
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    />
  );
}
