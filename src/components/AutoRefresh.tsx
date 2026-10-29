"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches server data a few times (e.g. while a Stripe webhook lands). */
export function AutoRefresh({ seconds, times }: { seconds: number; times: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      router.refresh();
      if (++n >= times) clearInterval(id);
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds, times]);
  return null;
}
