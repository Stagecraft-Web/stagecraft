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
    const sampleImage = {
      id: "abc1234567890def",
      alt: "stage shot",
      width: 1200,
      height: 800,
      placeholderDataUri: "data:image/webp;base64,AAAA",
      contentSlug: "uploads",
      originalExt: "jpg" as const,
    };

    it("uses a custom field for image picking (no raw text inputs for src/alt/width/height)", () => {
      // Puck's Config<T> generic collapses BlockProps.Image's fields type
      // through the branded ImageId — TS infers `fields` as `{}` so the
      // `image`/`caption` keys aren't statically reachable. Cast through
      // a permissive shape; runtime keys + types are what we're asserting.
      const fields = (puckConfig.components.Image.fields ?? {}) as Record<
        string,
        { type?: string }
      >;
      const fieldKeys = Object.keys(fields).sort();
      expect(fieldKeys).toEqual(["caption", "image"].sort());
      expect(fields.image?.type).toBe("custom");
    });

    it("renders an empty-state placeholder when image is null", () => {
      const html = render("Image", { image: null, caption: "" });
      expect(html).toContain("No image picked yet");
      expect(html).not.toContain("<picture");
    });

    it("renders the public <Image> (a <picture>) when image is set", () => {
      const html = render("Image", { image: sampleImage, caption: "" });
      expect(html).toContain("<picture");
      // The public Image component emits avif + webp <source> tags pointing
      // at /images/<slug>/<id>/<width>.<ext>
      expect(html).toMatch(/srcSet="\/images\/uploads\/abc1234567890def\/[0-9]+\.webp/);
      expect(html).toContain('alt="stage shot"');
    });

    it("renders <figcaption> only when caption is non-empty", () => {
      const without = render("Image", { image: sampleImage, caption: "" });
      const withCaption = render("Image", { image: sampleImage, caption: "Live at the venue" });
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

    it("renders a presentation div whose height is a CSS-token reference, distinct per size", () => {
      const refs = SPACER_SIZES.map((size) => {
        const html = render("Spacer", { size });
        const match = html.match(/height:\s*var\(--space-([0-9]+)\)/);
        expect(match, `Spacer size=${size} should resolve to a var(--space-N) token`).not.toBeNull();
        return parseInt(match![1], 10);
      });
      // sm < md < lg < xl (token numeric scale increases monotonically)
      expect(refs).toEqual([...refs].sort((a, b) => a - b));
      // and they're all distinct
      expect(new Set(refs).size).toBe(refs.length);
    });

    it("is aria-hidden (presentation only)", () => {
      const html = render("Spacer", { size: "md" });
      expect(html).toContain("aria-hidden");
    });
  });

  describe("Divider", () => {
    it("renders an <hr> with the default-margin token (no horizontal inset) when inset=false", () => {
      const html = render("Divider", { inset: false });
      expect(html).toContain("<hr");
      expect(html).toMatch(/margin:\s*var\(--space-[0-9]+\) 0/);
    });

    it("renders the inset-margin token pair (vertical + horizontal) when inset=true", () => {
      const html = render("Divider", { inset: true });
      expect(html).toMatch(/margin:\s*var\(--space-[0-9]+\) var\(--space-[0-9]+\)/);
    });
  });
});
