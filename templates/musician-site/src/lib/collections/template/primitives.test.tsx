import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { binding, literal } from "./binding";
import { ItemProvider } from "./context";
import {
  BlockList,
  Button,
  Image,
  Link,
  PRIMITIVE_BLOCKS,
  RichTextRender,
  Section,
  Stack,
  Text,
} from "./primitives";
import type { BlockInstance } from "./types";
import { asImageId } from "../../image-types";
import type { CollectionDef, Item } from "../schema";
import { FIXTURE_TIMESTAMP, tourDatesDef } from "../test-fixtures";

// ---------------------------------------------------------------------------
// Test harness — wraps a block in an item context and renders to HTML.
// ---------------------------------------------------------------------------

function makeItem(values: Item["values"]): Item {
  return {
    id: "item_test",
    slug: "test",
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    values,
  };
}

function renderInContext(
  node: React.ReactNode,
  values: Item["values"],
  collection: CollectionDef = tourDatesDef(),
): string {
  return renderToStaticMarkup(
    <ItemProvider item={makeItem(values)} collection={collection}>
      {node}
    </ItemProvider>,
  );
}

// ---------------------------------------------------------------------------
// PRIMITIVE_BLOCKS registry
// ---------------------------------------------------------------------------

describe("PRIMITIVE_BLOCKS registry", () => {
  it("registers all seven v1 primitives", () => {
    expect(Object.keys(PRIMITIVE_BLOCKS).sort()).toEqual(
      ["Button", "Image", "Link", "RichTextRender", "Section", "Stack", "Text"].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

describe("Text primitive", () => {
  it("renders a literal", () => {
    const html = renderInContext(<Text content={literal("Hello")} />, {});
    expect(html).toContain("Hello");
    expect(html).toMatch(/^<p[^>]*>Hello<\/p>$/);
  });

  it("renders a bound text field's value", () => {
    const html = renderInContext(
      <Text content={binding("fld_v")} />,
      { fld_v: { type: "text", value: "Paris" } },
    );
    expect(html).toContain("Paris");
  });

  it("hides when the bound field is missing (implicit hide-if-empty)", () => {
    const html = renderInContext(<Text content={binding("fld_missing")} />, {});
    expect(html).toBe("");
  });

  it("hides when the bound field's value is empty string", () => {
    const html = renderInContext(
      <Text content={binding("fld_v")} />,
      { fld_v: { type: "text", value: "" } },
    );
    expect(html).toBe("");
  });

  it("applies the requested variant and alignment", () => {
    const html = renderInContext(
      <Text content={literal("Label")} variant="label" align="center" />,
      {},
    );
    expect(html).toContain("text-align:center");
    expect(html).toContain("text-transform:uppercase");
  });
});

// ---------------------------------------------------------------------------
// Section + Stack — layout primitives with slot children
// ---------------------------------------------------------------------------

describe("Section + Stack layout", () => {
  it("Section wraps in a <section> with width + padding styles", () => {
    const html = renderInContext(
      <Section width="narrow" padding="large" blocks={[]} />,
      {},
    );
    expect(html).toMatch(/^<section[^>]*><\/section>$/);
    expect(html).toContain("max-width:var(--max-width-narrow)");
  });

  it("Stack defaults to vertical flex with a default gap", () => {
    const html = renderInContext(<Stack blocks={[]} />, {});
    expect(html).toContain("display:flex");
    expect(html).toContain("flex-direction:column");
    expect(html).toContain("gap:var(--space-4)");
  });

  it("Stack horizontal direction renders flex-direction:row", () => {
    const html = renderInContext(<Stack direction="horizontal" blocks={[]} />, {});
    expect(html).toContain("flex-direction:row");
  });

  it("Section renders its children blocks via the registry", () => {
    const children: BlockInstance[] = [
      { type: "Text", props: { content: literal("A") } },
      { type: "Text", props: { content: literal("B") } },
    ];
    const html = renderInContext(<Section blocks={children} />, {});
    expect(html).toContain("A");
    expect(html).toContain("B");
    expect(html.indexOf("A")).toBeLessThan(html.indexOf("B"));
  });

  it("unknown block types in children are skipped silently", () => {
    const children: BlockInstance[] = [
      { type: "DoesNotExist", props: {} },
      { type: "Text", props: { content: literal("kept") } },
    ];
    const html = renderInContext(<Section blocks={children} />, {});
    expect(html).toContain("kept");
    expect(html).not.toContain("DoesNotExist");
  });
});

// ---------------------------------------------------------------------------
// Button + Link
// ---------------------------------------------------------------------------

describe("Button + Link", () => {
  it("Button renders with label + href, both bindable", () => {
    const html = renderInContext(
      <Button
        label={literal("Buy tickets")}
        href={binding("fld_url")}
        variant="primary"
      />,
      { fld_url: { type: "url", value: "https://tix.example/abc" } },
    );
    expect(html).toContain("Buy tickets");
    expect(html).toContain('href="https://tix.example/abc"');
  });

  it("Button hides if href resolves to empty (ticket URL not set yet)", () => {
    const html = renderInContext(
      <Button label={literal("Buy tickets")} href={binding("fld_url")} />,
      {},
    );
    expect(html).toBe("");
  });

  it("Button hides if label resolves to empty", () => {
    const html = renderInContext(
      <Button label={binding("fld_lbl")} href={literal("https://x.com")} />,
      {},
    );
    expect(html).toBe("");
  });

  it("Link renders a plain anchor", () => {
    const html = renderInContext(
      <Link label={literal("Read more")} href={literal("https://x.com")} />,
      {},
    );
    expect(html).toBe('<a href="https://x.com">Read more</a>');
  });
});

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

describe("Image primitive", () => {
  const sampleImage = {
    id: asImageId("abc1234567890def"),
    alt: "Stage photo",
    width: 1600,
    height: 900,
    placeholderDataUri: "data:image/webp;base64,xxx",
    contentSlug: "tour-dates/paris-2026",
    originalExt: "jpg" as const,
  };

  it("hides if the bound image field is missing", () => {
    const html = renderInContext(<Image src={binding("fld_img")} />, {});
    expect(html).toBe("");
  });

  it("renders a <picture> with the bound image's variants", () => {
    const html = renderInContext(
      <Image src={binding("fld_img")} />,
      { fld_img: { type: "image", value: sampleImage } },
    );
    expect(html).toContain("<picture");
    expect(html).toContain("/images/tour-dates/paris-2026/");
    expect(html).toContain('alt="Stage photo"');
  });

  it("altOverride takes precedence over the image's stored alt", () => {
    const html = renderInContext(
      <Image src={binding("fld_img")} altOverride={literal("Custom alt")} />,
      { fld_img: { type: "image", value: sampleImage } },
    );
    expect(html).toContain('alt="Custom alt"');
    expect(html).not.toContain('alt="Stage photo"');
  });
});

// ---------------------------------------------------------------------------
// RichTextRender
// ---------------------------------------------------------------------------

describe("RichTextRender primitive", () => {
  it("renders the bound richText field's Tiptap content", () => {
    const html = renderInContext(
      <RichTextRender field="fld_bio" />,
      {
        fld_bio: {
          type: "richText",
          value: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Hello world." }] },
            ],
          },
        },
      },
    );
    expect(html).toBe("<p>Hello world.</p>");
  });

  it("renders nothing if the field is missing", () => {
    const html = renderInContext(<RichTextRender field="fld_missing" />, {});
    expect(html).toBe("");
  });
});

// ---------------------------------------------------------------------------
// BlockList — used by layout primitives
// ---------------------------------------------------------------------------

describe("BlockList", () => {
  it("returns null for an empty / missing list", () => {
    expect(renderToStaticMarkup(<BlockList blocks={undefined} />)).toBe("");
    expect(renderToStaticMarkup(<BlockList blocks={[]} />)).toBe("");
  });

  it("renders an array of blocks via the registry, in order", () => {
    const html = renderInContext(
      <BlockList
        blocks={[
          { type: "Text", props: { content: literal("first") } },
          { type: "Text", props: { content: literal("second") } },
        ]}
      />,
      {},
    );
    expect(html.indexOf("first")).toBeLessThan(html.indexOf("second"));
  });
});
