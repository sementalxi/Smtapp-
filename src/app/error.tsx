"use client";

import { useEffect } from "react";

/** Friendly page when something breaks on the server — with a retry button instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="font-display mt-4 text-3xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">Algo salió mal. Try again — if it keeps happening, the error is saved in Admin → Live log.</p>
      <div className="mt-6 flex gap-3">
        <button className="btn-primary" onClick={() => reset()}>↻ Try again</button>
        <a href="/" className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold">Home</a>
      </div>
      {error.digest && <p className="mt-4 text-[11px] text-muted">Code: {error.digest}</p>}
    </div>
  );
}
