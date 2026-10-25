import type { Metadata, Viewport } from "next";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { getNavCounts } from "@/lib/server/nav";
import { getProfile } from "@/lib/server/profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "My English Studio", template: "%s · My English Studio" },
  description: "A personal, adaptive studio for turning passive English into active speaking and writing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#131619" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const counts = getNavCounts();
  const profile = getProfile();
  return (
    <html lang="en-GB">
      <body>
        <AppShell counts={counts} learnerName={profile.name}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
