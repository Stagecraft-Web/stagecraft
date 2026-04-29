// ============================================================
// Live-preview mutations.
//
// Pure functions that know how to project an AppearanceState onto the
// document — writing CSS custom properties on :root and injecting a
// Google Fonts <link> if the family/weight set changes.
//
// Keeping these pure (they take the document/head as arguments) means we
// can unit-test them with a minimal DOM stub.
// ============================================================

import { computeFontSizes } from "../../lib/font-sizing";
import {
  appearanceToFontRequests,
  buildFontStack,
  buildGoogleFontsUrl,
} from "../../lib/google-fonts";
import type { AppearanceState } from "./types";

/** Writes every CSS variable the page consumes (mirrors BaseLayout's
 *  server-side inline <style>). Fonts that aren't loaded yet will fall back
 *  via the stack until injectPreviewFontsLink adds a new <link>.
 *
 *  `baseFontSizes` is the raw theme.json → typography.fontSize map. The
 *  sidebar passes it in from SidebarConfig so the live preview can apply
 *  the same transform BaseLayout does without re-reading theme.json. */
export function applyCssVariables(
  root: HTMLElement,
  appearance: AppearanceState,
  baseFontSizes: Record<string, string>,
): void {
  const { colors, typography } = appearance;
  const bodyStack = buildFontStack(typography.primary.family, typography.primary.category);
  const headingStack =
    typography.mode === "split" && typography.heading
      ? buildFontStack(typography.heading.family, typography.heading.category)
      : bodyStack;

  const fontSizes = computeFontSizes(
    baseFontSizes,
    typography.bodySizes,
    typography.headingSizes,
  );

  const SITE_TITLE_MULTIPLIERS: Record<string, number> = {
    "-2": 0.72,
    "-1": 0.85,
    "0": 1,
    "1": 1.15,
    "2": 1.35,
  };
  const siteTitleMultiplier =
    SITE_TITLE_MULTIPLIERS[String(appearance.siteTitleSize)] ?? 1;

  const vars: Record<string, string> = {
    "--color-primary": colors.primary,
    "--color-secondary": colors.secondary,
    "--color-accent": colors.accent,
    "--color-link": colors.linkColor,
    "--color-bg": colors.background,
    "--color-surface": colors.surface,
    "--color-text": colors.text,
    "--color-text-muted": colors.textMuted,
    "--color-border": colors.border,
    "--font-body": bodyStack,
    "--font-heading": headingStack,
    "--font-weight-body": String(typography.bodyWeights.body),
    "--font-weight-body-bold": String(typography.bodyWeights.bodyBold),
    "--font-weight-h1": String(typography.headingWeights.h1),
    "--font-weight-h2": String(typography.headingWeights.h2),
    "--font-weight-h3": String(typography.headingWeights.h3),
    "--font-weight-h4": String(typography.headingWeights.h4),
    "--site-title-multiplier": String(siteTitleMultiplier),
  };

  // Font-size vars — mirrors BaseLayout's inline <style>. Bucket names in
  // `fontSizes` match theme.json keys (xs / sm / base / lg / xl / 2xl / 3xl /
  // 4xl); each maps to a `--font-size-<bucket>` CSS var consumed by
  // global.css.
  for (const [bucket, value] of Object.entries(fontSizes)) {
    vars[`--font-size-${bucket}`] = value;
  }

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

const PREVIEW_LINK_ID = "stagecraft-appearance-preview-font-link";

/** Ensures <head> has a <link rel="stylesheet"> for exactly the fonts +
 *  weights the current draft needs. Noop when the URL matches the link
 *  already in place (prevents spurious network requests on every keystroke). */
export function injectPreviewFontsLink(head: HTMLHeadElement, appearance: AppearanceState): void {
  const url = buildGoogleFontsUrl(appearanceToFontRequests(appearance));
  const existing = head.querySelector<HTMLLinkElement>(`#${PREVIEW_LINK_ID}`);

  if (!url) {
    existing?.remove();
    return;
  }
  if (existing && existing.href === url) return;
  if (existing) {
    existing.href = url;
    return;
  }

  const link = head.ownerDocument.createElement("link");
  link.id = PREVIEW_LINK_ID;
  link.rel = "stylesheet";
  link.href = url;
  head.appendChild(link);
}

/** Combined shortcut used by the React hook — applies both CSS vars and the
 *  font link. Exposed separately so tests can drive each half independently.
 *  `baseFontSizes` is the raw theme.json fontSize map threaded through from
 *  SidebarConfig; see applyCssVariables for details. */
export function applyPreview(
  doc: Document,
  appearance: AppearanceState,
  baseFontSizes: Record<string, string>,
): void {
  applyCssVariables(doc.documentElement, appearance, baseFontSizes);
  injectPreviewFontsLink(doc.head, appearance);
}
