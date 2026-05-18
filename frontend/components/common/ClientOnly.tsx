"use client";

import { useEffect, useState } from "react";

/**
 * Renders children only on the client side (after hydration).
 * Use this to wrap any component that reads from localStorage/sessionStorage
 * to prevent SSR hydration mismatches.
 */
export default function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
