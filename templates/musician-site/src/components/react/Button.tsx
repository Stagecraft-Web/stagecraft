import type { MouseEventHandler, ReactNode } from "react";
import type { ButtonVariant } from "../../content-components/_shared/types";
import styles from "./Button.module.css";

export interface ButtonProps {
  /** When set, renders an `<a>`; otherwise renders a `<button>`. */
  href?: string;
  /** Visual variant. Defaults to `"primary"`. */
  variant?: ButtonVariant;
  /** Required for icon-only buttons (no visible text). */
  ariaLabel?: string;
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
  type = "button",
  className,
  isExternal,
  isDownload,
  onClick,
  isDisabled,
  id,
  label,
  children,
}: ButtonProps): ReactNode {
  const classes = [styles.btn, styles[variant], className].filter(Boolean).join(" ");
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
        aria-label={ariaLabel}
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
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={isDisabled}
    >
      {content}
    </button>
  );
}
