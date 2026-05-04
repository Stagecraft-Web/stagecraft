import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import {
  puckConfig,
  HEADING_LEVELS,
  SECTION_WIDTHS,
  BUTTON_VARIANTS,
  SPACER_SIZES,
} from "./config";

function render<K extends keyof typeof puckConfig.components>(
  name: K,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any,
): string {
  const component = puckConfig.components[name];
  // Puck's render is typed loosely; cast to a callable for tests.
  const renderFn = component.render as (p: unknown) => React.ReactElement;
  return renderToStaticMarkup(createElement(() => renderFn(props)));
}

describe("puckConfig", () => {
  it("exposes the expected block names", () => {
    expect(Object.keys(puckConfig.components).sort()).toEqual(
      ["Button", "Divider", "Heading", "Image", "RichText", "Section", "Spacer"].sort(),
    );
  });

  describe("Heading", () => {
    it("select options match HEADING_LEVELS", () => {
      const field = puckConfig.components.Heading.fields?.level;
      expect(field?.type).toBe("select");
      if (field?.type === "select") {
        expect(field.options.map((o) => o.value)).toEqual([...HEADING_LEVELS]);
      }
    });
  });

  describe("Section", () => {
    it("select options match SECTION_WIDTHS", () => {
      const field = puckConfig.components.Section.fields?.width;
      expect(field?.type).toBe("select");
      if (field?.type === "select") {
        expect(field.options.map((o) => o.value)).toEqual([...SECTION_WIDTHS]);
      }
    });
  });

  describe("RichText", () => {
    it("splits the textarea into multiple <p> tags on blank lines", () => {
      const html = render("RichText", { text: "First paragraph.\n\nSecond paragraph." });
      const matches = html.match(/<p>/g) ?? [];
      expect(matches).toHaveLength(2);
      expect(html).toContain("First paragraph.");
      expect(html).toContain("Second paragraph.");
    });

    it("ignores blank-only paragraphs (no empty <p></p>)", () => {
      const html = render("RichText", { text: "Hello.\n\n   \n\nWorld." });
      const matches = html.match(/<p>/g) ?? [];
      expect(matches).toHaveLength(2);
      expect(html).not.toContain("<p></p>");
    });

    it("renders a single <p> when the text has no blank lines", () => {
      const html = render("RichText", { text: "Just one paragraph." });
      const matches = html.match(/<p>/g) ?? [];
      expect(matches).toHaveLength(1);
    });
  });

  describe("Button", () => {
    it("select options match BUTTON_VARIANTS", () => {
      const field = puckConfig.components.Button.fields?.variant;
      expect(field?.type).toBe("select");
      if (field?.type === "select") {
        expect(field.options.map((o) => o.value)).toEqual([...BUTTON_VARIANTS]);
      }
    });

    it("renders an anchor with the given href + text", () => {
      const html = render("Button", { text: "Buy ticket", href: "/tickets", variant: "primary" });
      expect(html).toContain('href="/tickets"');
      expect(html).toContain("Buy ticket");
    });

    it("variant changes the inline style", () => {
      const primary = render("Button", { text: "x", href: "#", variant: "primary" });
      const outline = render("Button", { text: "x", href: "#", variant: "outline" });
      expect(primary).not.toBe(outline);
    });
  });

  describe("Image", () => {
    it("renders a placeholder when src is empty (editor-time empty state)", () => {
      const html = render("Image", { src: "", alt: "", width: 800, height: 600, caption: "" });
      expect(html).toContain("No image source set");
      expect(html).not.toContain("<img");
    });

    it("renders <figure><img> with width/height/alt when src is set", () => {
      const html = render("Image", {
        src: "/uploads/foo.webp",
        alt: "stage shot",
        width: 1200,
        height: 800,
        caption: "",
      });
      expect(html).toContain("<figure");
      expect(html).toContain('src="/uploads/foo.webp"');
      expect(html).toContain('alt="stage shot"');
      expect(html).toContain('width="1200"');
      expect(html).toContain('height="800"');
      expect(html).toContain('loading="lazy"');
    });

    it("renders <figcaption> only when caption is non-empty", () => {
      const without = render("Image", {
        src: "/x.webp", alt: "x", width: 800, height: 600, caption: "",
      });
      const withCaption = render("Image", {
        src: "/x.webp", alt: "x", width: 800, height: 600, caption: "Live at the venue",
      });
      expect(without).not.toContain("<figcaption");
      expect(withCaption).toContain("<figcaption");
      expect(withCaption).toContain("Live at the venue");
    });
  });

  describe("Spacer", () => {
    it("select options match SPACER_SIZES", () => {
      const field = puckConfig.components.Spacer.fields?.size;
      expect(field?.type).toBe("select");
      if (field?.type === "select") {
        expect(field.options.map((o) => o.value)).toEqual([...SPACER_SIZES]);
      }
    });

    it("renders a presentation div with the configured height (sm < md < lg < xl)", () => {
      const heights = SPACER_SIZES.map((size) => {
        const html = render("Spacer", { size });
        const match = html.match(/height:\s*([0-9.]+)rem/);
        expect(match).not.toBeNull();
        return parseFloat(match![1]);
      });
      // sm < md < lg < xl
      expect(heights).toEqual([...heights].sort((a, b) => a - b));
      // and they're all distinct
      expect(new Set(heights).size).toBe(heights.length);
    });

    it("is aria-hidden (presentation only)", () => {
      const html = render("Spacer", { size: "md" });
      expect(html).toContain("aria-hidden");
    });
  });

  describe("Divider", () => {
    it("renders an <hr> with default margins when not inset", () => {
      const html = render("Divider", { inset: false });
      expect(html).toContain("<hr");
      expect(html).toMatch(/margin:\s*2rem 0/);
    });

    it("renders inset margins when inset=true", () => {
      const html = render("Divider", { inset: true });
      expect(html).toMatch(/margin:\s*2rem 4rem/);
    });
  });
});
