import { describe, it, expect } from "vitest";

import { puckConfig, HEADING_LEVELS, SECTION_WIDTHS } from "./config";

describe("puckConfig", () => {
  it("defines Heading and Section blocks", () => {
    expect(Object.keys(puckConfig.components)).toEqual(
      expect.arrayContaining(["Heading", "Section"]),
    );
  });

  it("Heading select options match HEADING_LEVELS", () => {
    const heading = puckConfig.components.Heading;
    const options = heading.fields?.level;
    expect(options?.type).toBe("select");
    if (options?.type === "select") {
      expect(options.options.map((o) => o.value)).toEqual([...HEADING_LEVELS]);
    }
  });

  it("Section select options match SECTION_WIDTHS", () => {
    const section = puckConfig.components.Section;
    const options = section.fields?.width;
    expect(options?.type).toBe("select");
    if (options?.type === "select") {
      expect(options.options.map((o) => o.value)).toEqual([...SECTION_WIDTHS]);
    }
  });
});
