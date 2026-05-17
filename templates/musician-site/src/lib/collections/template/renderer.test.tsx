import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { binding, literal } from "./binding";
import { TemplateRenderer } from "./renderer";
import type { Template } from "./types";
import type { Item } from "../schema";
import { FIXTURE_TIMESTAMP, tourDatesDef } from "../test-fixtures";

function parisItem(): Item {
  return {
    id: "item_paris-2026",
    slug: "paris-2026",
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    values: {
      f_date: { type: "date", value: "2026-07-15" },
      f_venue: { type: "text", value: "La Cigale" },
      f_city: { type: "text", value: "Paris" },
      f_status: { type: "select", value: "on_sale" },
    },
  };
}

describe("TemplateRenderer", () => {
  it("returns null for a null template (collection with no template set)", () => {
    const html = renderToStaticMarkup(
      <TemplateRenderer template={null} item={parisItem()} collection={tourDatesDef()} />,
    );
    expect(html).toBe("");
  });

  it("returns nothing for an empty template content array", () => {
    const template: Template = { content: [], root: { props: {} } };
    const html = renderToStaticMarkup(
      <TemplateRenderer template={template} item={parisItem()} collection={tourDatesDef()} />,
    );
    expect(html).toBe("");
  });

  it("renders a tour-date card built from Section + Stack + Text", () => {
    // Realistic shape of a tour-dates itemTemplate as PR 7 might author
    // it: a Section wrapping a Stack of bound Text blocks.
    const template: Template = {
      content: [
        {
          type: "Section",
          props: {
            width: "default",
            padding: "default",
            blocks: [
              {
                type: "Stack",
                props: {
                  direction: "horizontal",
                  gap: "default",
                  align: "center",
                  justify: "between",
                  blocks: [
                    { type: "Text", props: { content: binding("f_date"), variant: "lead" } },
                    { type: "Text", props: { content: binding("f_venue"), variant: "body" } },
                    { type: "Text", props: { content: binding("f_city"), variant: "small" } },
                  ],
                },
              },
            ],
          },
        },
      ],
      root: { props: {} },
    };

    const html = renderToStaticMarkup(
      <TemplateRenderer template={template} item={parisItem()} collection={tourDatesDef()} />,
    );

    expect(html).toContain("2026-07-15");
    expect(html).toContain("La Cigale");
    expect(html).toContain("Paris");
    expect(html).toContain("<section");
    // The Stack should sit inside the Section
    expect(html.indexOf("<section")).toBeLessThan(html.indexOf("flex-direction:row"));
  });

  it("hides individual blocks whose bound fields are missing", () => {
    // Same template but the item has no f_venue value.
    const incomplete: Item = {
      ...parisItem(),
      values: {
        f_date: { type: "date", value: "2026-07-15" },
        f_city: { type: "text", value: "Paris" },
        f_status: { type: "select", value: "on_sale" },
      },
    };

    const template: Template = {
      content: [
        { type: "Text", props: { content: binding("f_date") } },
        { type: "Text", props: { content: binding("f_venue") } }, // missing → hides
        { type: "Text", props: { content: binding("f_city") } },
      ],
      root: { props: {} },
    };

    const html = renderToStaticMarkup(
      <TemplateRenderer template={template} item={incomplete} collection={tourDatesDef()} />,
    );

    expect(html).toContain("2026-07-15");
    expect(html).toContain("Paris");
    // Two paragraphs rendered, not three
    expect(html.match(/<p[^>]*>/g)?.length).toBe(2);
  });

  it("mixes literal and bound props in the same template", () => {
    const template: Template = {
      content: [
        { type: "Text", props: { content: literal("Where:"), variant: "label" } },
        { type: "Text", props: { content: binding("f_venue"), variant: "lead" } },
      ],
      root: { props: {} },
    };

    const html = renderToStaticMarkup(
      <TemplateRenderer template={template} item={parisItem()} collection={tourDatesDef()} />,
    );
    expect(html).toContain("Where:");
    expect(html).toContain("La Cigale");
    expect(html.indexOf("Where:")).toBeLessThan(html.indexOf("La Cigale"));
  });

  it("accepts a custom registry (extension point for PR 7's Collection blocks)", () => {
    const customRegistry = {
      Marker: () => <div data-test="custom-block">marker</div>,
    };
    const template: Template = {
      content: [{ type: "Marker", props: {} }],
      root: { props: {} },
    };
    const html = renderToStaticMarkup(
      <TemplateRenderer
        template={template}
        item={parisItem()}
        collection={tourDatesDef()}
        registry={customRegistry}
      />,
    );
    expect(html).toContain('data-test="custom-block"');
    expect(html).toContain("marker");
  });
});
