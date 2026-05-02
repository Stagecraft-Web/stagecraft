/**
 * Shared Keystatic Markdoc content components.
 *
 * Derived from the content-components registry so that every embeddable
 * block (image, button, embed, release-list, posts-list, …) can be offered
 * both in the Pages collection's Markdoc editor AND in any other rich-body
 * collection (currently: Posts).
 *
 * Both consumers import this const by reference so a new component registered
 * in `src/content-components/index.ts` automatically becomes insertable in
 * every collection that uses rich Markdoc bodies — no per-collection update
 * required.
 */
import { components as contentComponents } from "../content-components";

export const pageContentComponents = Object.fromEntries(
  contentComponents.map(({ tagName, keystatic }) => [tagName, keystatic]),
);
