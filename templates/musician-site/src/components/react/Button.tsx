import type { MouseEventHandler, ReactNode } from "react";
import type { ButtonVariant } from "../../content-components/_shared/types";
import styles from "./Button.module.css";

/**
 * Visual variant. The `"primary"` and `"outline"` options come from the
 * site's content-component vocabulary (used by Markdoc / Astro callers).
 * `"unstyled"` is a sidebar / admin-chrome escape hatch — no base or
 * variant class is applied, so the caller's `className` is the only
 * source of styling. Use it for icon buttons, pill triggers, +/- steppers,
 * etc. that don't fit the primary/outline pattern.
 */
export type ButtonVariantOrUnstyled = ButtonVariant | "unstyled";

export interface ButtonProps {
  /** When set, renders an `<a>`; otherwise renders a `<button>`. */
  href?: string;
  /** Visual variant. Defaults to `"primary"`. Use `"unstyled"` to skip
   *  both the base `.btn` class and the variant class — only `className`
   *  applies. */
  variant?: ButtonVariantOrUnstyled;
  /** Required for icon-only buttons (no visible text). */
  ariaLabel?: string;
  /** ID of an element this button controls (e.g. a disclosure panel).
   *  Only the controls + expanded pair are exposed here — the rest of
   *  the ARIA grab-bag stays out of the API until something needs it. */
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
  /** HTML button type. Ignored when `href` is set. */
  type?: "button" | "submit" | "reset";
  /** Extra CSS classes appended after the variant class. */
  className?: string;
  /** Open the link in a new tab — only meaningful when `href` is set. */
  isExternal?: boolean;
  /**
   * When true, renders as `<a download>` so browsers save the file instead
   * of navigating to it. Only meaningful with `href`. The `download`
   * attribute is only honored for same-origin URLs; cross-origin links may
   * still navigate.
   */
  isDownload?: boolean;
  /** Click handler. Wired through to the underlying element; on Astro/SSR
   *  pages this is a no-op (no React runtime), so use sparingly. */
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  /** Disable the underlying `<button>`. Ignored when `href` is set —
   *  there's no native disabled state for `<a>`. */
  isDisabled?: boolean;
  /** Optional `id` for the rendered element. */
  id?: string;
  /** Native `title` tooltip. Useful for explaining why a button is disabled. */
  title?: string;
  /** Visible text. Markdoc tags pass this via the `label` prop because
   *  they have no children; React/Astro callers can use children instead. */
  label?: string;
  children?: ReactNode;
}

/**
 * SSR-friendly React `Button`. Astro's `Button.astro` is a thin wrapper that
 * server-renders this component to plain HTML, so the same primitive backs
 * Astro pages, Markdoc tags, and React islands.
 *
 * Polymorphic on `href`: with `href` set, renders an `<a>`; without, a
 * `<button>`. Variant + extra className compose into the final class string;
 * the visual styles live in the colocated CSS module.
 */
export default function Button({
  href,
  variant = "primary",
  ariaLabel,
  "aria-controls": ariaControls,
  "aria-expanded": ariaExpanded,
  type = "button",
  className,
  isExternal,
  isDownload,
  onClick,
  isDisabled,
  id,
  title,
  label,
  children,
}: ButtonProps): ReactNode {
  const classes =
    variant === "unstyled"
      ? className
      : [styles.btn, styles[variant], className].filter(Boolean).join(" ");
  const content = (
    <>
      {label}
      {children}
    </>
  );

  if (href) {
    const externalAttrs = isExternal
      ? { target: "_blank" as const, rel: "noopener noreferrer" }
      : {};
    // The empty-string `download` attribute mirrors `<a download>` (no
    // suggested filename); set isDownload === true to enable.
    const downloadAttrs = isDownload ? { download: "" } : {};
    return (
      <a
        href={href}
        id={id}
        className={classes}
        title={title}
        aria-label={ariaLabel}
        aria-controls={ariaControls}
        aria-expanded={ariaExpanded}
        onClick={onClick}
        {...externalAttrs}
        {...downloadAttrs}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      id={id}
      className={classes}
      title={title}
      aria-label={ariaLabel}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      onClick={onClick}
      disabled={isDisabled}
    >
      {content}
    </button>
  );
}
