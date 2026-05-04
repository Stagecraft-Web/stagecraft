import type { Config } from "@measured/puck";

import { Image as PublicImage } from "@/components/Image";
import type { ImageMetadata } from "@/lib/image-types";

import { ImagePickerField } from "./ImagePickerField";

export const HEADING_LEVELS = ["h1", "h2", "h3"] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export const SECTION_WIDTHS = ["sm", "md", "lg", "full"] as const;
export type SectionWidth = (typeof SECTION_WIDTHS)[number];

export const BUTTON_VARIANTS = ["primary", "secondary", "outline"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const SPACER_SIZES = ["sm", "md", "lg", "xl"] as const;
export type SpacerSize = (typeof SPACER_SIZES)[number];

const SECTION_WIDTH_MAX: Record<SectionWidth, string> = {
  sm: "32rem",
  md: "48rem",
  lg: "64rem",
  full: "100%",
};

const SPACER_HEIGHT: Record<SpacerSize, string> = {
  sm: "1rem",
  md: "2rem",
  lg: "4rem",
  xl: "8rem",
};

const BUTTON_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "#111827",
    color: "#ffffff",
    border: "1px solid #111827",
  },
  secondary: {
    background: "#f3f4f6",
    color: "#111827",
    border: "1px solid #f3f4f6",
  },
  outline: {
    background: "transparent",
    color: "#111827",
    border: "1px solid #111827",
  },
};

const BUTTON_BASE: React.CSSProperties = {
  display: "inline-block",
  padding: "0.5rem 1rem",
  borderRadius: "0.375rem",
  textDecoration: "none",
  fontWeight: 600,
  cursor: "pointer",
};

export type BlockProps = {
  Heading: { text: string; level: HeadingLevel };
  Section: { width: SectionWidth; headline: string; body: string };
  RichText: { text: string };
  Button: { text: string; href: string; variant: ButtonVariant };
  Image: {
    /** Full ImageMetadata returned by /api/upload-image, or null when not yet picked. */
    image: ImageMetadata | null;
    caption: string;
  };
  Spacer: { size: SpacerSize };
  Divider: { inset: boolean };
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
    RichText: {
      fields: { text: { type: "textarea" } },
      defaultProps: {
        text: "Write your paragraph here.\n\nBlank lines start a new paragraph.",
      },
      render: ({ text }) => (
        <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "0 1rem" }}>
          {text
            .split(/\n\s*\n/)
            .filter((p) => p.trim().length > 0)
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
        </div>
      ),
    },
    Button: {
      fields: {
        text: { type: "text" },
        href: { type: "text" },
        variant: {
          type: "select",
          options: BUTTON_VARIANTS.map((v) => ({ label: v, value: v })),
        },
      },
      defaultProps: { text: "Click me", href: "#", variant: "primary" },
      render: ({ text, href, variant }) => (
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <a
            href={href}
            style={{ ...BUTTON_BASE, ...BUTTON_STYLE[variant] }}
          >
            {text}
          </a>
        </div>
      ),
    },
    Image: {
      fields: {
        image: {
          type: "custom",
          render: ({ value, onChange }) => (
            <ImagePickerField
              value={(value as ImageMetadata | null) ?? null}
              onChange={(next) => onChange(next as ImageMetadata | null)}
            />
          ),
        },
        caption: { type: "text" },
      },
      defaultProps: { image: null, caption: "" },
      render: ({ image, caption }) => {
        if (!image) {
          return (
            <div
              style={{
                maxWidth: "48rem",
                margin: "0 auto",
                padding: "2rem 1rem",
                textAlign: "center",
                color: "#6b7280",
                fontStyle: "italic",
              }}
            >
              No image picked yet
            </div>
          );
        }
        // Puck's Config<T> generic collapses ImageMetadata's branded `id`
        // (`string & { ... [imageIdBrand]: never }`) into its methods-as-
        // properties form during type mapping, so `image` here is no longer
        // structurally assignable to ImageMetadata even though its runtime
        // shape is identical. Cast at the render boundary.
        return (
          <figure style={{ maxWidth: "48rem", margin: "0 auto", padding: "1rem" }}>
            <PublicImage image={image as ImageMetadata} />
            {caption ? (
              <figcaption
                style={{
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  textAlign: "center",
                  marginTop: "0.5rem",
                }}
              >
                {caption}
              </figcaption>
            ) : null}
          </figure>
        );
      },
    },
    Spacer: {
      fields: {
        size: {
          type: "select",
          options: SPACER_SIZES.map((v) => ({ label: v, value: v })),
        },
      },
      defaultProps: { size: "md" },
      render: ({ size }) => (
        <div
          aria-hidden
          style={{ height: SPACER_HEIGHT[size] }}
        />
      ),
    },
    Divider: {
      fields: { inset: { type: "radio", options: [
        { label: "full-width", value: false },
        { label: "inset", value: true },
      ] } },
      defaultProps: { inset: false },
      render: ({ inset }) => (
        <hr
          style={{
            border: "none",
            borderTop: "1px solid #e5e7eb",
            margin: inset ? "2rem 4rem" : "2rem 0",
          }}
        />
      ),
    },
  },
};
