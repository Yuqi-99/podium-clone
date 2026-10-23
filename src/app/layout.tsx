import type { Metadata } from "next";
import { StudioShell } from "@/components/studio-shell";
import "./source.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000"),
  title: "Podium | Creative Studio & Video Production for Sports",
  description: "Creative direction, film production and photography for sports brands worldwide.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body><StudioShell>{children}</StudioShell></body></html>;
}
