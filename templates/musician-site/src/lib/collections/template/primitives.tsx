/**
 * The Primitive block library.
 *
 * Each export is a React component that:
 *
 *   1. Reads the surrounding item context via `useItemContext()`.
 *   2. Resolves its `Bindable<T>` props against that item via
 *      `resolveBindable` (binding.ts).
 *   3. Renders the result with CSS-custom-property styling (per
 *      CLAUDE.md §7 — no hard-coded hex / px / weights).
 *
 * Layout primitives (Section, Stack) accept a `children: BlockInstance[]`
 * slot and dispatch nested blocks via `<BlockList>`. The slot field
 * lives on the on-disk data; the editor in PR 6 maps Puck's slot
 * authoring affordance to this same shape.
 *
 * Field-render primitives (RichTextRender) take a fieldId directly
 * (never a Bindable — there's no literal alternative; the whole point
 * is to render a field's rich value at a position).
 *
 * Implicit hide-if-empty: any Bindable prop that resolves to `undefined`
 * causes the surrounding block to render nothing — the "hide ticket
 * button if there's no ticket URL" pattern from ADR §4.1.
 */

"use client";

import type { CSSProperties, ReactNode } from "react";

import { Image as PublicImage } from "@/components/Image";

import { resolveBindable, resolveBinding, resolveStringBindable } from "./binding";
import { useItemContext } from "./context";
import { renderTiptap } from "./tiptap-render";
import type { BlockInstance } from "./types";
import type { Bindable, FieldId } from "../schema";

// ---------------------------------------------------------------------------
// BlockList — renders an array of nested blocks. Used by layout primitives
// for their `children` slot, and by the top-level TemplateRenderer.
// ---------------------------------------------------------------------------

export type BlockRegistry = Record<string, (props: Record<string, unknown>) => ReactNode>;

/**
 * A small registry consumers can extend (e.g. PR 7 adds Collection
 * blocks). Exported for the renderer; tests build their own subsets.
 */
export const PRIMITIVE_BLOCKS: BlockRegistry = {
  // populated below after each component is defined
};

export function BlockList({
  blocks,
  registry = PRIMITIVE_BLOCKS,
}: {
  blocks: BlockInstance[] | undefined;
  registry?: BlockRegistry;
}): ReactNode {
  if (!blocks || blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, i) => {
        const Render = registry[block.type];
        if (!Render) {
          // Unknown block type — render nothing rather than crashing.
          // The editor (PR 6) won't let the artist author an unknown
          // block; this branch covers a template that pre-dates a
          // block deletion or a Puck plugin removal.
          return null;
        }
        return <BlockSlot key={i} render={Render} props={block.props} />;
      })}
    </>
  );
}

/**
 * Wrapper around an individual registry entry. Exists so the consumer
 * sees a stable React element with `key` set, rather than calling each
 * render function directly inside `.map()`.
 */
function BlockSlot({
  render,
  props,
}: {
  render: (props: Record<string, unknown>) => ReactNode;
  props: Record<string, unknown>;
}): ReactNode {
  return <>{render(props)}</>;
}

// ---------------------------------------------------------------------------
// Section — top-level wrapper with width + padding controls
// ---------------------------------------------------------------------------

export const SECTION_WIDTHS = ["narrow", "default", "wide", "full"] as const;
export type SectionWidth = (typeof SECTION_WIDTHS)[number];

export const SECTION_PADDINGS = ["none", "default", "large"] as const;
export type SectionPadding = (typeof SECTION_PADDINGS)[number];

const SECTION_MAX_WIDTH: Record<SectionWidth, string> = {
  narrow: "var(--max-width-narrow)",
  default: "var(--max-width-content)",
  wide: "var(--max-width-wide)",
  full: "100%",
};

const SECTION_PADDING_VALUE: Record<SectionPadding, string> = {
  none: "0",
  default: "var(--space-8) var(--space-4)",
  large: "var(--space-16) var(--space-4)",
};

export type SectionProps = {
  width?: SectionWidth;
  padding?: SectionPadding;
  blocks?: BlockInstance[];
};

export function Section(props: Record<string, unknown>): ReactNode {
  const { width = "default", padding = "default", blocks } = props as SectionProps;
  const style: CSSProperties = {
    maxWidth: SECTION_MAX_WIDTH[width],
    margin: "0 auto",
    padding: SECTION_PADDING_VALUE[padding],
  };
  return (
    <section style={style}>
      <BlockList blocks={blocks} />
    </section>
  );
}
PRIMITIVE_BLOCKS.Section = Section;

// ---------------------------------------------------------------------------
// Stack — flex container, vertical or horizontal
// ---------------------------------------------------------------------------

export const STACK_DIRECTIONS = ["vertical", "horizontal"] as const;
export type StackDirection = (typeof STACK_DIRECTIONS)[number];

export const STACK_GAPS = ["none", "small", "default", "large"] as const;
export type StackGap = (typeof STACK_GAPS)[number];

export const STACK_ALIGNMENTS = ["start", "center", "end", "stretch"] as const;
export type StackAlignment = (typeof STACK_ALIGNMENTS)[number];

export const STACK_JUSTIFICATIONS = ["start", "center", "end", "between"] as const;
export type StackJustification = (typeof STACK_JUSTIFICATIONS)[number];

const STACK_GAP_VALUE: Record<StackGap, string> = {
  none: "0",
  small: "var(--space-2)",
  default: "var(--space-4)",
  large: "var(--space-8)",
};

const STACK_JUSTIFY_VALUE: Record<StackJustification, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
};

const STACK_ALIGN_VALUE: Record<StackAlignment, CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

export type StackProps = {
  direction?: StackDirection;
  gap?: StackGap;
  align?: StackAlignment;
  justify?: StackJustification;
  blocks?: BlockInstance[];
};

export function Stack(props: Record<string, unknown>): ReactNode {
  const {
    direction = "vertical",
    gap = "default",
    align = "stretch",
    justify = "start",
    blocks,
  } = props as StackProps;
  const style: CSSProperties = {
    display: "flex",
    flexDirection: direction === "vertical" ? "column" : "row",
    gap: STACK_GAP_VALUE[gap],
    alignItems: STACK_ALIGN_VALUE[align],
    justifyContent: STACK_JUSTIFY_VALUE[justify],
  };
  return (
    <div style={style}>
      <BlockList blocks={blocks} />
    </div>
  );
}
PRIMITIVE_BLOCKS.Stack = Stack;

// ---------------------------------------------------------------------------
// Text — single text block, bindable content
// ---------------------------------------------------------------------------

export const TEXT_VARIANTS = ["body", "small", "lead", "label"] as const;
export type TextVariant = (typeof TEXT_VARIANTS)[number];

export const TEXT_ALIGNS = ["start", "center", "end"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

const TEXT_VARIANT_STYLE: Record<TextVariant, CSSProperties> = {
  body: { fontSize: "var(--font-size-base)" },
  small: { fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" },
  lead: { fontSize: "var(--font-size-lg)" },
  label: {
    fontSize: "var(--font-size-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--color-text-muted)",
  },
};

export type TextProps = {
  content: Bindable<string>;
  variant?: TextVariant;
  align?: TextAlign;
};

export function Text(props: Record<string, unknown>): ReactNode {
  const { item } = useItemContext();
  const { content, variant = "body", align = "start" } = props as TextProps;
  // Text accepts any string-valued field type — see STRING_VALUED_FIELD_TYPES
  // in ./binding.ts. The editor's binding picker enforces this set at
  // authoring time; the resolver re-checks defensively.
  const resolved = resolveStringBindable(content, item);
  if (resolved === undefined || resolved === "") return null;
  const style: CSSProperties = {
    ...TEXT_VARIANT_STYLE[variant],
    textAlign: align,
    margin: 0,
  };
  return <p style={style}>{resolved}</p>;
}
PRIMITIVE_BLOCKS.Text = Text;

// ---------------------------------------------------------------------------
// Image — image with optional alt override (default alt comes from
// the ImageMetadata's own `alt` field).
// ---------------------------------------------------------------------------

export type ImageBlockProps = {
  src: Bindable<unknown>;          // ImageMetadata at the type level; widened to unknown
                                   // because the literal arm doesn't easily express the
                                   // full shape. Resolver re-narrows.
  altOverride?: Bindable<string>;
};

export function Image(props: Record<string, unknown>): ReactNode {
  const { item } = useItemContext();
  const { src, altOverride } = props as ImageBlockProps;
  const resolvedSrc = resolveBindable(src as Bindable<never>, item, "image");
  if (resolvedSrc === undefined) return null;
  const altOverrideResolved = altOverride
    ? resolveStringBindable(altOverride, item)
    : undefined;
  const metadata =
    altOverrideResolved !== undefined && altOverrideResolved !== ""
      ? { ...resolvedSrc, alt: altOverrideResolved }
      : resolvedSrc;
  return <PublicImage image={metadata} />;
}
PRIMITIVE_BLOCKS.Image = Image;

// ---------------------------------------------------------------------------
// Button — bindable label and href
// ---------------------------------------------------------------------------

export const BUTTON_VARIANTS = ["primary", "secondary", "outline"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

const BUTTON_VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
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

const BUTTON_BASE_STYLE: CSSProperties = {
  display: "inline-block",
  padding: "var(--space-2) var(--space-4)",
  borderRadius: "var(--radius)",
  textDecoration: "none",
  fontWeight: "var(--font-weight-semibold)" as unknown as number,
};

export type ButtonProps = {
  label: Bindable<string>;
  href: Bindable<string>;
  variant?: ButtonVariant;
};

export function Button(props: Record<string, unknown>): ReactNode {
  const { item } = useItemContext();
  const { label, href, variant = "primary" } = props as ButtonProps;
  const resolvedLabel = resolveStringBindable(label, item);
  const resolvedHref = resolveStringBindable(href, item);
  if (
    resolvedLabel === undefined ||
    resolvedLabel === "" ||
    resolvedHref === undefined ||
    resolvedHref === ""
  ) {
    return null;
  }
  const style: CSSProperties = { ...BUTTON_BASE_STYLE, ...BUTTON_VARIANT_STYLE[variant] };
  return (
    <a href={resolvedHref} style={style}>
      {resolvedLabel}
    </a>
  );
}
PRIMITIVE_BLOCKS.Button = Button;

// ---------------------------------------------------------------------------
// Link — plain inline link
// ---------------------------------------------------------------------------

export type LinkProps = {
  label: Bindable<string>;
  href: Bindable<string>;
};

export function Link(props: Record<string, unknown>): ReactNode {
  const { item } = useItemContext();
  const { label, href } = props as LinkProps;
  const resolvedLabel = resolveStringBindable(label, item);
  const resolvedHref = resolveStringBindable(href, item);
  if (
    resolvedLabel === undefined ||
    resolvedLabel === "" ||
    resolvedHref === undefined ||
    resolvedHref === ""
  ) {
    return null;
  }
  return <a href={resolvedHref}>{resolvedLabel}</a>;
}
PRIMITIVE_BLOCKS.Link = Link;

// ---------------------------------------------------------------------------
// RichTextRender — renders a richText field's Tiptap doc at this position
// ---------------------------------------------------------------------------

export type RichTextRenderProps = {
  /** Field id pointing at a richText field on the current collection. */
  field: FieldId;
};

export function RichTextRender(props: Record<string, unknown>): ReactNode {
  const { item } = useItemContext();
  const { field } = props as RichTextRenderProps;
  const doc = resolveBinding(field, item, "richText");
  if (doc === undefined) return null;
  return renderTiptap(doc);
}
PRIMITIVE_BLOCKS.RichTextRender = RichTextRender;
