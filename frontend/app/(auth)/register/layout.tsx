import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chess Skyscraper — Register",
  description: "Create your account and join the ultimate chess arena.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
