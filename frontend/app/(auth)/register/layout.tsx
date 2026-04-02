import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Obsidian Ultra — Grandmaster Tier",
  description: "Join the Pantheon of Grandmasters in the most exclusive digital arena ever forged.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}