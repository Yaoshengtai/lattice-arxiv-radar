import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "../../app/globals.css";

export const metadata: Metadata = {
  title: "Lattice — Public arXiv research radar",
  description: "A read-only snapshot of a Codex-driven research profile and math-aware paper library.",
  icons: {
    icon: "/lattice-arxiv-radar/favicon.svg",
    shortcut: "/lattice-arxiv-radar/favicon.svg",
  },
};

export default function PublicRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
