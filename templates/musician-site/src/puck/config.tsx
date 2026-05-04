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

// All visual values come from CSS custom properties (see app/globals.css).
// CLAUDE.md §7 forbids raw hex/px/size values in inline styles.
const SECTION_WIDTH_MAX: Record<SectionWidth, string> = {
  sm: "var(--max-width-narrow)",
  md: "var(--max-width-content)",
  lg: "var(--max-width-wide)",
  full: "100%",
};

const SPACER_HEIGHT: Record<SpacerSize, string> = {
  sm: "var(--space-4)",
  md: "var(--space-8)",
  lg: "var(--space-16)",
  xl: "var(--space-32)",
};

const BUTTON_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--color-action)",
    color: "var(--color-action-fg)",
    border: "1px solid var(--color-action)",
  },
  secondary: {
    background: "var(--color-surface-raised)",
    color: "var(--color-text)",
    border: "1px solid var(--color-surface-raised)",
  },
  outline: {
    background: "transparent",
    color: "var(--color-text)",
    border: "1px solid var(--color-text)",
  },
};

const BUTTON_BASE: React.CSSProperties = {
  display: "inline-block",
  padding: "var(--space-2) var(--space-4)",
  borderRadius: "var(--radius)",
  textDecoration: "none",
  fontWeight: "var(--font-weight-semibold)",
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
            padding: "var(--space-8) var(--space-4)",
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
        <div
          style={{
            maxWidth: "var(--max-width-content)",
            margin: "0 auto",
            padding: "0 var(--space-4)",
          }}
        >
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
        <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
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
                maxWidth: "var(--max-width-content)",
                margin: "0 auto",
                padding: "var(--space-8) var(--space-4)",
                textAlign: "center",
                color: "var(--color-text-muted)",
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
          <figure
            style={{
              maxWidth: "var(--max-width-content)",
              margin: "0 auto",
              padding: "var(--space-4)",
            }}
          >
            <PublicImage image={image as ImageMetadata} />
            {caption ? (
              <figcaption
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-muted)",
                  textAlign: "center",
                  marginTop: "var(--space-2)",
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
            borderTop: "1px solid var(--color-border)",
            margin: inset ? "var(--space-8) var(--space-16)" : "var(--space-8) 0",
          }}
        />
      ),
    },
  },
};
