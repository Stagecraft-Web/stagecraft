/**
 * Aggregated registry of every embeddable content-component.
 *
 * Each entry is a namespace re-export of a folder's index.ts, which in turn
 * re-exports three things from that component's schema.ts:
 *
 *   - `markdoc`  — markdoc tag definition consumed by markdoc.config.ts
 *   - `keystatic` — keystatic block/wrapper consumed by keystatic.config.ts
 *   - `tagName` — the markdoc tag slug (e.g. "content-image", "release-list")
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
export * as Video from "./Video";
export * as Card from "./Card";
export * as ReleaseList from "./ReleaseList";
export * as PhotoGallery from "./PhotoGallery";
export * as ImageCarousel from "./ImageCarousel";
export * as VideoGallery from "./VideoGallery";
export * as TourDatesList from "./TourDatesList";
export * as StoreItemList from "./StoreItemList";
export * as ContactForm from "./ContactForm";
export * as Embed from "./Embed";
export * as EmbedResponsive from "./EmbedResponsive";
export * as PostsList from "./PostsList";
export * as NewsletterSignup from "./NewsletterSignup";
export * as NewsletterEmailField from "./NewsletterEmailField";
export * as NewsletterPhoneField from "./NewsletterPhoneField";
export * as NewsletterTextField from "./NewsletterTextField";
export * as NewsletterSelectField from "./NewsletterSelectField";
export * as Quote from "./Quote";
export * as CenteredBlock from "./CenteredBlock";

import * as Section from "./Section";
import * as FullscreenSection from "./FullscreenSection";
import * as Button from "./Button";
import * as Columns from "./Columns";
import * as Column from "./Column";
import * as Image from "./Image";
import * as Video from "./Video";
import * as Card from "./Card";
import * as ReleaseList from "./ReleaseList";
import * as PhotoGallery from "./PhotoGallery";
import * as ImageCarousel from "./ImageCarousel";
import * as VideoGallery from "./VideoGallery";
import * as TourDatesList from "./TourDatesList";
import * as StoreItemList from "./StoreItemList";
import * as ContactForm from "./ContactForm";
import * as Embed from "./Embed";
import * as EmbedResponsive from "./EmbedResponsive";
import * as PostsList from "./PostsList";
import * as NewsletterSignup from "./NewsletterSignup";
import * as NewsletterEmailField from "./NewsletterEmailField";
import * as NewsletterPhoneField from "./NewsletterPhoneField";
import * as NewsletterTextField from "./NewsletterTextField";
import * as NewsletterSelectField from "./NewsletterSelectField";
import * as Quote from "./Quote";
import * as CenteredBlock from "./CenteredBlock";

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
  Video,
  Card,
  ReleaseList,
  PhotoGallery,
  ImageCarousel,
  VideoGallery,
  TourDatesList,
  StoreItemList,
  ContactForm,
  Embed,
  EmbedResponsive,
  PostsList,
  NewsletterSignup,
  NewsletterEmailField,
  NewsletterPhoneField,
  NewsletterTextField,
  NewsletterSelectField,
  Quote,
  CenteredBlock,
] as const;
