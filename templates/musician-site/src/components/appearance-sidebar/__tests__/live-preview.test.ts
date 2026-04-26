import { beforeEach, describe, expect, it } from "vitest";
import { applyCssVariables, applyPreview, injectPreviewFontsLink } from "../live-preview";
import type { AppearanceState } from "../types";

// Minimal document factory — we could pull in happy-dom or jsdom, but the
// functions under test only touch .style.setProperty on an HTMLElement,
// head.appendChild/querySelector/removeChild, and document.createElement.
// Rolling our own stub keeps the test runtime light and doesn't force a
// DOM environment on the whole vitest config.

function makeStubDocument() {
  const style: Record<string, string> = {};
  const headChildren: any[] = [];
  const root = {
    style: {
      setProperty(name: string, value: string) {
        style[name] = value;
      },
      getProperty(name: string) {
        return style[name] ?? "";
      },
    },
  };
  const head: any = {
    ownerDocument: null as any,
    appendChild(el: any) {
      headChildren.push(el);
      return el;
    },
    removeChild(el: any) {
      const i = headChildren.indexOf(el);
      if (i >= 0) headChildren.splice(i, 1);
    },
    querySelector(sel: string) {
      // Only supports "#id"
      if (!sel.startsWith("#")) return null;
      const id = sel.slice(1);
      return headChildren.find((c) => c.id === id) ?? null;
    },
  };
  const doc: any = {
    documentElement: root,
    head,
    createElement(tag: string) {
      const el: any = { tagName: tag.toUpperCase(), remove() { head.removeChild(el); } };
      return el;
    },
  };
  head.ownerDocument = doc;
  return { doc, style, headChildren };
}

// theme.json fontSize baseline, threaded through from BaseLayout. The sidebar
// applies per-bucket overrides on top; empty/missing values fall through.
const BASE_FONT_SIZES = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.25rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "2.5rem",
  "4xl": "3.5rem",
};

const baseAppearance: AppearanceState = {
  colors: {
    primary: "#111",
    secondary: "#222",
    accent: "#333",
    linkColor: "#333",
    background: "#fff",
    surface: "#fafafa",
    text: "#000",
    textMuted: "#666",
    border: "#ccc",
  },
  typography: {
    mode: "split",
    primary: { category: "sans-serif", family: "Inter" },
    heading: { category: "serif", family: "Merriweather" },
    bodySizes: { xs: "", sm: "", base: "", lg: "" },
    bodyWeights: { body: 400, bodyBold: 700 },
    headingSizes: { xl: "", "2xl": "", "3xl": "", "4xl": "" },
    headingWeights: { h1: 700, h2: 600, h3: 600, h4: 500 },
  },
};

describe("applyCssVariables", () => {
  let stub: ReturnType<typeof makeStubDocument>;
  beforeEach(() => {
    stub = makeStubDocument();
  });

  it("writes every color variable to :root", () => {
    applyCssVariables(stub.doc.documentElement, baseAppearance, BASE_FONT_SIZES);
    expect(stub.style["--color-primary"]).toBe("#111");
    expect(stub.style["--color-secondary"]).toBe("#222");
    expect(stub.style["--color-bg"]).toBe("#fff");
    expect(stub.style["--color-text-muted"]).toBe("#666");
    expect(stub.style["--color-border"]).toBe("#ccc");
  });

  it("writes font stacks for body and heading when mode is split", () => {
    applyCssVariables(stub.doc.documentElement, baseAppearance, BASE_FONT_SIZES);
    expect(stub.style["--font-body"]).toBe("Inter, sans-serif");
    expect(stub.style["--font-heading"]).toBe("Merriweather, serif");
  });

  it("uses body stack for heading when mode is single", () => {
    applyCssVariables(
      stub.doc.documentElement,
      {
        ...baseAppearance,
        typography: { ...baseAppearance.typography, mode: "single", heading: null },
      },
      BASE_FONT_SIZES,
    );
    expect(stub.style["--font-body"]).toBe("Inter, sans-serif");
    expect(stub.style["--font-heading"]).toBe("Inter, sans-serif");
  });

  it("writes weight variables as strings (split body/heading blocks)", () => {
    applyCssVariables(stub.doc.documentElement, baseAppearance, BASE_FONT_SIZES);
    expect(stub.style["--font-weight-body"]).toBe("400");
    expect(stub.style["--font-weight-h2"]).toBe("600");
    expect(stub.style["--font-weight-h4"]).toBe("500");
  });

  it("writes --color-link", () => {
    applyCssVariables(
      stub.doc.documentElement,
      {
        ...baseAppearance,
        colors: { ...baseAppearance.colors, linkColor: "#ff00aa" },
      },
      BASE_FONT_SIZES,
    );
    expect(stub.style["--color-link"]).toBe("#ff00aa");
  });

  it("writes font-size vars equal to baseline when no per-bucket overrides are set", () => {
    applyCssVariables(stub.doc.documentElement, baseAppearance, BASE_FONT_SIZES);
    expect(stub.style["--font-size-base"]).toBe("1rem");
    expect(stub.style["--font-size-xs"]).toBe("0.75rem");
    expect(stub.style["--font-size-4xl"]).toBe("3.5rem");
  });

  it("applies a body-bucket override and leaves other buckets untouched", () => {
    applyCssVariables(
      stub.doc.documentElement,
      {
        ...baseAppearance,
        typography: {
          ...baseAppearance.typography,
          bodySizes: { ...baseAppearance.typography.bodySizes, base: "1.125rem" },
        },
      },
      BASE_FONT_SIZES,
    );
    expect(stub.style["--font-size-base"]).toBe("1.125rem");
    expect(stub.style["--font-size-xs"]).toBe("0.75rem");
    expect(stub.style["--font-size-4xl"]).toBe("3.5rem");
  });

  it("applies a heading-bucket override and leaves body buckets untouched", () => {
    applyCssVariables(
      stub.doc.documentElement,
      {
        ...baseAppearance,
        typography: {
          ...baseAppearance.typography,
          headingSizes: { ...baseAppearance.typography.headingSizes, "4xl": "4rem" },
        },
      },
      BASE_FONT_SIZES,
    );
    expect(stub.style["--font-size-base"]).toBe("1rem");
    expect(stub.style["--font-size-4xl"]).toBe("4rem");
  });
});

describe("injectPreviewFontsLink", () => {
  let stub: ReturnType<typeof makeStubDocument>;
  beforeEach(() => {
    stub = makeStubDocument();
  });

  it("inserts a new link when none exists", () => {
    injectPreviewFontsLink(stub.doc.head, baseAppearance);
    const link = stub.headChildren.find((c) => c.id === "stagecraft-appearance-preview-font-link");
    expect(link).toBeDefined();
    expect(link.href).toContain("fonts.googleapis.com");
    expect(link.rel).toBe("stylesheet");
  });

  it("updates the href of the existing link on re-apply", () => {
    injectPreviewFontsLink(stub.doc.head, baseAppearance);
    const before = stub.headChildren.find(
      (c) => c.id === "stagecraft-appearance-preview-font-link",
    ).href;

    // Change to Merriweather-only (single mode) — URL must change.
    injectPreviewFontsLink(stub.doc.head, {
      ...baseAppearance,
      typography: { ...baseAppearance.typography, mode: "single", heading: null },
    });

    const links = stub.headChildren.filter(
      (c) => c.id === "stagecraft-appearance-preview-font-link",
    );
    expect(links.length).toBe(1);
    expect(links[0].href).not.toBe(before);
    expect(links[0].href).not.toContain("Merriweather"); // single mode uses Inter only
  });

  it("does not touch the DOM when the URL hasn't changed (no spurious reloads)", () => {
    injectPreviewFontsLink(stub.doc.head, baseAppearance);
    const firstLink = stub.headChildren.find(
      (c) => c.id === "stagecraft-appearance-preview-font-link",
    );
    injectPreviewFontsLink(stub.doc.head, baseAppearance);
    const secondLink = stub.headChildren.find(
      (c) => c.id === "stagecraft-appearance-preview-font-link",
    );
    expect(secondLink).toBe(firstLink); // same object reference
  });
});

describe("applyPreview", () => {
  it("applies both CSS vars and the fonts link in one call", () => {
    const stub = makeStubDocument();
    applyPreview(stub.doc, baseAppearance, BASE_FONT_SIZES);
    expect(stub.style["--color-primary"]).toBe("#111");
    expect(stub.headChildren.some((c) => c.id === "stagecraft-appearance-preview-font-link")).toBe(
      true,
    );
  });

  it("projects per-bucket overrides into --font-size-* vars", () => {
    const stub = makeStubDocument();
    applyPreview(
      stub.doc,
      {
        ...baseAppearance,
        typography: {
          ...baseAppearance.typography,
          bodySizes: { ...baseAppearance.typography.bodySizes, base: "1.07rem" },
        },
      },
      BASE_FONT_SIZES,
    );
    expect(stub.style["--font-size-base"]).toBe("1.07rem");
  });
});
