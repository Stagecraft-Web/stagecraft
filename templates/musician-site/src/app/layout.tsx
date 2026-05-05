import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

/**
 * Read the git commit SHA the platform deployed. Vercel sets
 * `VERCEL_GIT_COMMIT_SHA`, Netlify sets `COMMIT_REF`. Either one identifies
 * "what's actually live right now" — the editor at /admin polls the public
 * site after publishing and waits until this meta tag matches the SHA the
 * publish API returned, before declaring the change "live".
 */
function getDeployedSha(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.COMMIT_REF ??
    "dev"
  );
}

export const metadata: Metadata = {
  title: "Musician Site",
  other: {
    "stagecraft-deployed-sha": getDeployedSha(),
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
