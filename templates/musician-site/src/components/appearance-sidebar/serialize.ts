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

import type { AppearanceState } from "./types";

/** Serialise an AppearanceState into the JSON string that belongs at
 *  `src/content/config/appearance.json`. Indent matches the existing file
 *  (2 spaces, trailing newline) so commits from the sidebar look identical
 *  to commits from Keystatic's UI. */
export function serializeAppearanceForKeystatic(state: AppearanceState): string {
  const heading = state.typography.mode === "split" && state.typography.heading
    ? {
        discriminant: "split" as const,
        value: {
          discriminant: state.typography.heading.category,
          value: state.typography.heading.family,
        },
      }
    : { discriminant: "single" as const, value: null };

  const payload = {
    colors: state.colors,
    typography: {
      primary: {
        discriminant: state.typography.primary.category,
        value: state.typography.primary.family,
      },
      heading,
      weights: {
        // Weights are stored as strings because Keystatic's <select> emits
        // strings; the reader-side schema coerces to number.
        body: String(state.typography.weights.body),
        bodyBold: String(state.typography.weights.bodyBold),
        h1: String(state.typography.weights.h1),
        h2: String(state.typography.weights.h2),
        h3: String(state.typography.weights.h3),
        h4: String(state.typography.weights.h4),
        h5: String(state.typography.weights.h5),
        h6: String(state.typography.weights.h6),
      },
    },
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

  const weightLabels: Record<keyof AppearanceState["typography"]["weights"], string> = {
    body: "body weight",
    bodyBold: "body-bold weight",
    h1: "h1 weight",
    h2: "h2 weight",
    h3: "h3 weight",
    h4: "h4 weight",
    h5: "h5 weight",
    h6: "h6 weight",
  };
  for (const key of Object.keys(prev.typography.weights) as Array<
    keyof AppearanceState["typography"]["weights"]
  >) {
    if (prev.typography.weights[key] !== next.typography.weights[key]) {
      changes.push({
        label: weightLabels[key],
        from: String(prev.typography.weights[key]),
        to: String(next.typography.weights[key]),
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
