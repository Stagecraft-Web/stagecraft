import { defineMarkdocConfig, component } from "@astrojs/markdoc/config";
import { components } from "./src/content-components";

// ---------------------------------------------------------------------------
// Markdoc custom tags.
//
// This file is a thin aggregator: each tag's render path and attribute schema
// lives in its component's src/content-components/<Name>/schema.ts. We iterate
// the exported list and project each `markdoc` shape into the format
// `defineMarkdocConfig` expects — `render` paths get wrapped with the
// `component(...)` helper so Astro can resolve them at build time.
//
// To add a new tag, create the component folder and register it in
// src/content-components/index.ts. No changes needed here.
// ---------------------------------------------------------------------------

const tags = Object.fromEntries(
  components.map(({ tagName, markdoc }) => [
    tagName,
    { ...markdoc, render: component(markdoc.render) },
  ]),
);

export default defineMarkdocConfig({ tags });
