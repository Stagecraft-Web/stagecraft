/**
 * Aggregated registry of every embeddable content-component.
 *
 * Each entry is a namespace re-export of a folder's index.ts, which in turn
 * re-exports three things from that component's schema.ts:
 *
 *   - `markdoc`  — markdoc tag definition consumed by markdoc.config.ts
 *   - `keystatic` — keystatic block/wrapper consumed by keystatic.config.ts
 *   - `tagName` — the markdoc tag slug (e.g. "content-image", "press-quotes")
 *
 * Add a new component by:
 *   1. Creating src/content-components/MyComponent/{MyComponent.astro,schema.ts,index.ts}
 *      (plus preview.tsx if it has an admin preview).
 *   2. Adding `export * as MyComponent from "./MyComponent";` below.
 *   3. Appending the name to the `components` array.
 *
 * markdoc.config.ts and keystatic.config.ts iterate the array — no other
 * edits needed there.
 */
export * as Section from "./Section";
export * as FullscreenSection from "./FullscreenSection";
export * as Button from "./Button";
export * as Columns from "./Columns";
export * as Column from "./Column";
export * as Image from "./Image";
export * as ReleaseList from "./ReleaseList";
export * as PressQuotes from "./PressQuotes";
export * as PhotoGallery from "./PhotoGallery";
export * as ContactForm from "./ContactForm";
export * as MediaEmbed from "./MediaEmbed";

import * as Section from "./Section";
import * as FullscreenSection from "./FullscreenSection";
import * as Button from "./Button";
import * as Columns from "./Columns";
import * as Column from "./Column";
import * as Image from "./Image";
import * as ReleaseList from "./ReleaseList";
import * as PressQuotes from "./PressQuotes";
import * as PhotoGallery from "./PhotoGallery";
import * as ContactForm from "./ContactForm";
import * as MediaEmbed from "./MediaEmbed";

/**
 * Ordered list of every content-component. The order affects nothing at
 * runtime (markdoc/keystatic both key by tag name) but matches the UI
 * grouping: layout blocks first, then content blocks.
 */
export const components = [
  Section,
  FullscreenSection,
  Button,
  Columns,
  Column,
  Image,
  ReleaseList,
  PressQuotes,
  PhotoGallery,
  ContactForm,
  MediaEmbed,
] as const;
