"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Notice } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="page page-narrow stack">
      <Notice tone="error" title="Something went wrong on this page">
        Your saved work is safe. You can try again, or go back to your learning space.
        {error.digest && <span className="tiny muted"> (Reference: {error.digest})</span>}
      </Notice>
      <div className="row">
        <Button variant="primary" onClick={reset}>Try again</Button>
        <ButtonLink href="/">Back to your learning space</ButtonLink>
      </div>
    </div>
  );
}
