import type { Config } from "@measured/puck";

export const HEADING_LEVELS = ["h1", "h2", "h3"] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export const SECTION_WIDTHS = ["sm", "md", "lg", "full"] as const;
export type SectionWidth = (typeof SECTION_WIDTHS)[number];

const SECTION_WIDTH_MAX: Record<SectionWidth, string> = {
  sm: "32rem",
  md: "48rem",
  lg: "64rem",
  full: "100%",
};

export type BlockProps = {
  Heading: { text: string; level: HeadingLevel };
  Section: { width: SectionWidth; headline: string; body: string };
};

export const puckConfig: Config<BlockProps> = {
  components: {
    Heading: {
      fields: {
        text: { type: "text" },
        level: {
          type: "select",
          options: HEADING_LEVELS.map((v) => ({ label: v.toUpperCase(), value: v })),
        },
      },
      defaultProps: { text: "Heading", level: "h2" },
      render: ({ text, level }) => {
        const Tag = level;
        return <Tag>{text}</Tag>;
      },
    },
    Section: {
      fields: {
        width: {
          type: "select",
          options: SECTION_WIDTHS.map((v) => ({ label: v, value: v })),
        },
        headline: { type: "text" },
        body: { type: "textarea" },
      },
      defaultProps: { width: "md", headline: "Section title", body: "Section body" },
      render: ({ width, headline, body }) => (
        <section
          style={{
            maxWidth: SECTION_WIDTH_MAX[width],
            margin: "0 auto",
            padding: "2rem 1rem",
          }}
        >
          <h2>{headline}</h2>
          <p>{body}</p>
        </section>
      ),
    },
  },
};
