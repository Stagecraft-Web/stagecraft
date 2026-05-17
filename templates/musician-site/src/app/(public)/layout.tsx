import type { ReactNode } from "react";

import { AppearanceStyles } from "@/components/AppearanceStyles";
import { readAppearance } from "@/lib/content";

/**
 * Public-site layout wrapper.
 *
 * Loaded only by routes inside `src/app/(public)/` — not by `/admin` or
 * `/api/*`. Injects the appearance-driven CSS variables and Google Fonts
 * link so every public page renders with the artist's chosen palette and
 * typography without each page handler having to opt in.
 *
 * Header + Footer are rendered per-page (not here) so individual pages can
 * suppress them (splash pages skip both; the per-page "Hide footer" toggle
 * drops just the footer).
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const appearance = await readAppearance();
  return (
    <div className="stagecraft-site">
      <AppearanceStyles appearance={appearance} />
      {children}
    </div>
  );
}
