// ============================================================
// Draft → appearance.json JSON string.
//
// appearanceSchema (Zod) transforms on PARSE: incoming Keystatic-format
// JSON with `{ discriminant, value }` gets flattened to `{ category, family }`.
// When saving, we need to go the other way — take the runtime shape the
// sidebar uses and project it back into Keystatic's on-disk shape so
// Keystatic's admin UI can round-trip our commits.
//
// This function is the single place that knows Keystatic's file format,
// so if the schema evolves we only have to change it here.
// ============================================================

import { pxToRem } from "../../lib/font-sizing";
import { BODY_FONT_SIZE_BUCKETS, HEADING_FONT_SIZE_BUCKETS } from "../../lib/schemas";
import type { AppearanceState } from "./types";

/** Render a per-bucket pixel override for a commit-message diff line.
 *  `0` reads as "(default)"; non-zero reads as the rem equivalent. */
function formatSizeChange(px: number): string {
  return px > 0 ? pxToRem(px) : "(default)";
}

/** Serialise an AppearanceState into the JSON string that belongs at
 *  `src/content/config/appearance.json`. Indent matches the existing file
 *  (2 spaces, trailing newline) so commits from the sidebar look identical
 *  to commits from Keystatic's UI. */
export function serializeAppearanceForKeystatic(state: AppearanceState): string {
  const heading = state.typography.mode === "split" && state.typography.heading
    ? {
        discriminant: false as const,
        value: {
          discriminant: state.typography.heading.category,
          value: state.typography.heading.family,
        },
      }
    : { discriminant: true as const, value: null };

  // linkColor is optional on the schema; we compare against accent to decide
  // whether the user set one distinctly. If they match, omit the field so
  // round-tripped appearance.json stays minimal (matches what Keystatic's
  // empty-text-input semantics produce on a fresh save).
  const linkColorOut =
    state.colors.linkColor && state.colors.linkColor !== state.colors.accent
      ? state.colors.linkColor
      : "";

  // Build size objects with explicit per-bucket entries so the on-disk shape
  // matches the Keystatic schema exactly (field order = bucket order). Values
  // are integer pixels — `0` means "use theme.json baseline".
  const bodySizesOut = Object.fromEntries(
    BODY_FONT_SIZE_BUCKETS.map((b) => [b, state.typography.bodySizes[b] ?? 0]),
  );
  const headingSizesOut = Object.fromEntries(
    HEADING_FONT_SIZE_BUCKETS.map((b) => [b, state.typography.headingSizes[b] ?? 0]),
  );

  const payload = {
    colors: {
      primary: state.colors.primary,
      secondary: state.colors.secondary,
      accent: state.colors.accent,
      linkColor: linkColorOut,
      background: state.colors.background,
      surface: state.colors.surface,
      text: state.colors.text,
      textMuted: state.colors.textMuted,
      border: state.colors.border,
    },
    typography: {
      primary: {
        discriminant: state.typography.primary.category,
        value: state.typography.primary.family,
      },
      bodySizes: bodySizesOut,
      bodyWeights: {
        // Weights are stored as strings because Keystatic's <select> emits
        // strings; the reader-side schema coerces to number.
        body: String(state.typography.bodyWeights.body),
        bodyBold: String(state.typography.bodyWeights.bodyBold),
      },
      heading,
      headingSizes: headingSizesOut,
      headingWeights: {
        h1: String(state.typography.headingWeights.h1),
        h2: String(state.typography.headingWeights.h2),
        h3: String(state.typography.headingWeights.h3),
        h4: String(state.typography.headingWeights.h4),
      },
    },
    siteTitleSize: String(state.siteTitleSize),
  };

  return JSON.stringify(payload, null, 2) + "\n";
}

// ============================================================
// Commit-message builder.
//
// Diffs two AppearanceStates and produces a human-readable summary suitable
// for a commit message headline ("Update appearance: primary color, heading
// font") and an optional body listing individual changes. Keeps the git
// history meaningful without the author having to type anything.
// ============================================================

interface Change {
  label: string;
  from: string;
  to: string;
}

function collectChanges(prev: AppearanceState, next: AppearanceState): Change[] {
  const changes: Change[] = [];

  const colorLabels: Record<keyof AppearanceState["colors"], string> = {
    primary: "primary color",
    secondary: "secondary color",
    accent: "accent color",
    linkColor: "link color",
    background: "background color",
    surface: "surface color",
    text: "text color",
    textMuted: "muted-text color",
    border: "border color",
  };
  for (const key of Object.keys(prev.colors) as Array<keyof AppearanceState["colors"]>) {
    if (prev.colors[key] !== next.colors[key]) {
      changes.push({ label: colorLabels[key], from: prev.colors[key], to: next.colors[key] });
    }
  }

  if (prev.typography.mode !== next.typography.mode) {
    changes.push({
      label: "font strategy",
      from: prev.typography.mode,
      to: next.typography.mode,
    });
  }

  if (prev.typography.primary.family !== next.typography.primary.family) {
    changes.push({
      label: "body font",
      from: prev.typography.primary.family,
      to: next.typography.primary.family,
    });
  }

  const prevHeadingFamily = prev.typography.heading?.family ?? "(same as body)";
  const nextHeadingFamily = next.typography.heading?.family ?? "(same as body)";
  if (prevHeadingFamily !== nextHeadingFamily) {
    changes.push({ label: "heading font", from: prevHeadingFamily, to: nextHeadingFamily });
  }

  const bodyWeightLabels: Record<keyof AppearanceState["typography"]["bodyWeights"], string> = {
    body: "body weight",
    bodyBold: "body-bold weight",
  };
  for (const key of Object.keys(prev.typography.bodyWeights) as Array<
    keyof AppearanceState["typography"]["bodyWeights"]
  >) {
    if (prev.typography.bodyWeights[key] !== next.typography.bodyWeights[key]) {
      changes.push({
        label: bodyWeightLabels[key],
        from: String(prev.typography.bodyWeights[key]),
        to: String(next.typography.bodyWeights[key]),
      });
    }
  }

  if (prev.siteTitleSize !== next.siteTitleSize) {
    changes.push({
      label: "site title size",
      from: String(prev.siteTitleSize),
      to: String(next.siteTitleSize),
    });
  }

  const headingWeightLabels: Record<keyof AppearanceState["typography"]["headingWeights"], string> = {
    h1: "h1 weight",
    h2: "h2 weight",
    h3: "h3 weight",
    h4: "h4 weight",
  };
  for (const key of Object.keys(prev.typography.headingWeights) as Array<
    keyof AppearanceState["typography"]["headingWeights"]
  >) {
    if (prev.typography.headingWeights[key] !== next.typography.headingWeights[key]) {
      changes.push({
        label: headingWeightLabels[key],
        from: String(prev.typography.headingWeights[key]),
        to: String(next.typography.headingWeights[key]),
      });
    }
  }

  // Per-bucket size overrides — surface each bucket distinctly so the diff
  // reads naturally ("base size: (default) → 1.125rem"). An override
  // toggling between 0 (use baseline) and a real px value still shows up.
  for (const key of Object.keys(prev.typography.bodySizes) as Array<
    keyof AppearanceState["typography"]["bodySizes"]
  >) {
    if (prev.typography.bodySizes[key] !== next.typography.bodySizes[key]) {
      changes.push({
        label: `${key} size`,
        from: formatSizeChange(prev.typography.bodySizes[key]),
        to: formatSizeChange(next.typography.bodySizes[key]),
      });
    }
  }
  for (const key of Object.keys(prev.typography.headingSizes) as Array<
    keyof AppearanceState["typography"]["headingSizes"]
  >) {
    if (prev.typography.headingSizes[key] !== next.typography.headingSizes[key]) {
      changes.push({
        label: `${key} size`,
        from: formatSizeChange(prev.typography.headingSizes[key]),
        to: formatSizeChange(next.typography.headingSizes[key]),
      });
    }
  }

  return changes;
}

export function buildCommitMessage(
  prev: AppearanceState,
  next: AppearanceState,
): { headline: string; body: string } {
  const changes = collectChanges(prev, next);

  if (changes.length === 0) {
    return {
      headline: "Update appearance",
      body: "No detected changes — file rewritten as-is.",
    };
  }

  // Short headline: just the labels.
  const labels = changes.map((c) => c.label);
  const headline =
    changes.length <= 3
      ? `Update appearance: ${labels.join(", ")}`
      : `Update appearance: ${labels.slice(0, 2).join(", ")} and ${labels.length - 2} more`;

  const bodyLines = [
    ...changes.map((c) => `- ${c.label}: ${c.from} → ${c.to}`),
    "",
    "Edited via the Stagecraft appearance sidebar.",
  ];

  return { headline, body: bodyLines.join("\n") };
}
