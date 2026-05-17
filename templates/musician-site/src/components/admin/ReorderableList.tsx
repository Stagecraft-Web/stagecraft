"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Lightweight reorderable list with up/down/remove controls. Used by the
 * Navigation panel to pick which pages appear in the header and in what
 * order. Drag-and-drop would be nicer but adds a dependency; the button
 * pattern is keyboard-accessible and good enough for ~10-item nav menus.
 *
 * Items can be any string set; the parent owns the array.
 */
export type ReorderableListProps<T extends string> = {
  items: readonly T[];
  onChange: (next: T[]) => void;
  /** Render the visible label for one item — keeps presentation in the parent. */
  renderLabel: (item: T) => ReactNode;
  /** Optional empty-state node when `items` is empty. */
  emptyState?: ReactNode;
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-surface)",
};

const iconButtonStyle: CSSProperties = {
  padding: "var(--space-1) var(--space-2)",
  fontSize: "var(--font-size-xs)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  cursor: "pointer",
  borderRadius: "var(--radius-sm)",
  lineHeight: 1,
};

export function ReorderableList<T extends string>({
  items,
  onChange,
  renderLabel,
  emptyState,
}: ReorderableListProps<T>) {
  function move(i: number, delta: -1 | 1) {
    const next = [...items];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-3)",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-sm)",
          fontStyle: "italic",
        }}
      >
        {emptyState ?? "No items."}
      </div>
    );
  }

  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      {items.map((item, i) => (
        <li key={item} style={rowStyle}>
          <span
            aria-hidden
            style={{
              minWidth: "1.5rem",
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {i + 1}
          </span>
          <span style={{ flex: 1, fontSize: "var(--font-size-sm)" }}>
            {renderLabel(item)}
          </span>
          <button
            type="button"
            onClick={() => move(i, -1)}
            disabled={i === 0}
            aria-label={`Move ${item} up`}
            style={{
              ...iconButtonStyle,
              cursor: i === 0 ? "not-allowed" : "pointer",
              opacity: i === 0 ? 0.4 : 1,
            }}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(i, 1)}
            disabled={i === items.length - 1}
            aria-label={`Move ${item} down`}
            style={{
              ...iconButtonStyle,
              cursor: i === items.length - 1 ? "not-allowed" : "pointer",
              opacity: i === items.length - 1 ? 0.4 : 1,
            }}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label={`Remove ${item}`}
            style={{
              ...iconButtonStyle,
              color: "var(--color-text-error)",
            }}
          >
            Remove
          </button>
        </li>
      ))}
    </ol>
  );
}
