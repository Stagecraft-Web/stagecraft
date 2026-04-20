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

import {
  appearanceToFontRequests,
  buildFontStack,
  buildGoogleFontsUrl,
} from "../../lib/google-fonts";
import type { AppearanceState } from "./types";

/** Writes every CSS variable the page consumes (mirrors BaseLayout's
 *  server-side inline <style>). Fonts that aren't loaded yet will fall back
 *  via the stack until injectPreviewFontsLink adds a new <link>. */
export function applyCssVariables(root: HTMLElement, appearance: AppearanceState): void {
  const { colors, typography } = appearance;
  const bodyStack = buildFontStack(typography.primary.family, typography.primary.category);
  const headingStack =
    typography.mode === "split" && typography.heading
      ? buildFontStack(typography.heading.family, typography.heading.category)
      : bodyStack;

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
    "--font-weight-body": String(typography.weights.body),
    "--font-weight-body-bold": String(typography.weights.bodyBold),
    "--font-weight-h1": String(typography.weights.h1),
    "--font-weight-h2": String(typography.weights.h2),
    "--font-weight-h3": String(typography.weights.h3),
    "--font-weight-h4": String(typography.weights.h4),
    "--font-weight-h5": String(typography.weights.h5),
    "--font-weight-h6": String(typography.weights.h6),
  };

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
 *  font link. Exposed separately so tests can drive each half independently. */
export function applyPreview(doc: Document, appearance: AppearanceState): void {
  applyCssVariables(doc.documentElement, appearance);
  injectPreviewFontsLink(doc.head, appearance);
}
