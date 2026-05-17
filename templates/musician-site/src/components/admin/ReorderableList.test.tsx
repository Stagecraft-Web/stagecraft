import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReorderableList } from "./ReorderableList";

function render(props: Parameters<typeof ReorderableList<string>>[0]) {
  return renderToStaticMarkup(<ReorderableList {...props} />);
}

describe("<ReorderableList>", () => {
  it("renders one row per item, in supplied order", () => {
    const html = render({
      items: ["a", "b", "c"],
      onChange: vi.fn(),
      renderLabel: (s) => <strong>{s}</strong>,
    });
    const positions = ["a", "b", "c"].map((s) => html.indexOf(`<strong>${s}</strong>`));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  it("disables the up arrow on the first row and the down arrow on the last row", () => {
    const html = render({
      items: ["one", "two", "three"],
      onChange: vi.fn(),
      renderLabel: (s) => s,
    });
    // React SSR emits attributes in the order it sees them; `disabled` is
    // rendered before `aria-label`, so the assertion matches across the
    // whole tag (`<button ... aria-label="...">`).
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Move one up"/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Move three down"/);
    // The middle row's buttons are enabled — no `disabled` attribute appears
    // inside that tag.
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*aria-label="Move two up"/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*aria-label="Move two down"/);
  });

  it("renders the empty-state when items is empty", () => {
    const html = render({
      items: [],
      onChange: vi.fn(),
      renderLabel: (s) => s,
      emptyState: "Nothing here yet",
    });
    expect(html).toContain("Nothing here yet");
  });

  it("falls back to a default empty message when none provided", () => {
    const html = render({
      items: [],
      onChange: vi.fn(),
      renderLabel: (s) => s,
    });
    expect(html).toContain("No items.");
  });

  it("renders a Remove button for every item", () => {
    const html = render({
      items: ["a", "b"],
      onChange: vi.fn(),
      renderLabel: (s) => s,
    });
    const removes = html.match(/Remove/g) ?? [];
    expect(removes.length).toBeGreaterThanOrEqual(2);
  });
});
