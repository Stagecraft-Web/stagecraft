/**
 * Pure helpers for the {% video %} block.
 *
 * Lives outside Video.astro so the markdoc-attribute validation and the
 * autoplay-stripping logic can be unit-tested without spinning up Astro
 * (mirrors the toEmbeddable.ts pattern next door in VideoGallery/).
 */

export type VideoType = "youtube" | "vimeo";

export interface VideoMarkdocProps {
  slug?: string;
  url?: string;
  type?: VideoType;
  title?: string;
}

export type ResolvedVideoSource =
  | { mode: "collection"; slug: string }
  | { mode: "url"; url: string; type: VideoType; title?: string };

/**
 * Validate the (slug XOR url) constraint markdoc can't express in attribute
 * schema, and narrow the prop union into a discriminated `ResolvedVideoSource`.
 *
 * Throws on:
 *   - both slug and url present (or both absent)
 *   - url present without type
 *   - type present that isn't "youtube" or "vimeo"
 *
 * The thrown message names the {% video %} tag and the specific bad shape so
 * a build-time failure points the author straight at the right authoring fix.
 */
export function validateVideoProps(
  props: VideoMarkdocProps,
): ResolvedVideoSource {
  const hasSlug = typeof props.slug === "string" && props.slug.length > 0;
  const hasUrl = typeof props.url === "string" && props.url.length > 0;

  if (hasSlug === hasUrl) {
    throw new Error(
      `{% video %}: provide exactly one of \`slug\` (collection lookup) or \`url\` (direct embed). ` +
        `Got slug=${JSON.stringify(props.slug)}, url=${JSON.stringify(props.url)}.`,
    );
  }

  if (hasSlug) {
    return { mode: "collection", slug: props.slug! };
  }

  if (!props.type) {
    throw new Error(
      `{% video %}: \`type\` is required when \`url\` is set. ` +
        `Use type="youtube" or type="vimeo".`,
    );
  }
  if (props.type !== "youtube" && props.type !== "vimeo") {
    throw new Error(
      `{% video %}: \`type\` must be "youtube" or "vimeo", got ${JSON.stringify(props.type)}.`,
    );
  }

  return {
    mode: "url",
    url: props.url!,
    type: props.type,
    title: props.title,
  };
}

/**
 * Strip an `autoplay=1` query param from a URL. The VideoGallery lightbox
 * bakes autoplay into its embed URLs because the user has just clicked to
 * open the modal — playing immediately matches that intent. Inline embeds
 * are passive content, so we hand the cleaned URL to the iframe.
 *
 * Implemented by mutating searchParams via `URL` (handles encoding, ordering,
 * and missing-param edge-cases for free). If the input isn't a parseable URL
 * we return it untouched — toEmbeddable would have produced null in that
 * case anyway, so we'd never get here in practice.
 */
export function withoutAutoplay(embedUrl: string): string {
  try {
    const u = new URL(embedUrl);
    u.searchParams.delete("autoplay");
    return u.toString();
  } catch {
    return embedUrl;
  }
}
