import { defineMarkdocConfig, component } from "@astrojs/markdoc/config";

export default defineMarkdocConfig({
  tags: {
    section: {
      render: component("./src/components/Section.astro"),
      attributes: {
        title: { type: String },
        headingLevel: { type: String, default: "h2" },
        isTitleHidden: { type: Boolean, default: false },
      },
    },
    "fullscreen-section": {
      render: component("./src/components/FullscreenSection.astro"),
      attributes: {
        title: { type: String },
        headingLevel: { type: String, default: "h2" },
        isTitleHidden: { type: Boolean, default: false },
        image: { type: String },
      },
    },
    button: {
      render: component("./src/components/Button.astro"),
      attributes: {
        href: { type: String },
        variant: { type: String, default: "primary" },
        isExternal: { type: Boolean, default: false },
      },
    },
    columns: {
      render: component("./src/components/Columns.astro"),
      attributes: {
        layout: { type: String, default: "1-1" },
      },
    },
    column: {
      render: component("./src/components/Column.astro"),
      attributes: {},
    },
    "content-image": {
      render: component("./src/components/ContentImage.astro"),
      selfClosing: true,
      attributes: {
        src: { type: String, required: true },
        alt: { type: String, required: true },
      },
    },
    "epk-download": {
      render: component("./src/components/EpkDownload.astro"),
      selfClosing: true,
      attributes: {
        path: { type: String, required: true },
        label: { type: String, default: "Download EPK" },
      },
    },
    "release-list": {
      render: component("./src/components/ReleaseList.astro"),
      selfClosing: true,
      attributes: {},
    },
    "press-quotes": {
      render: component("./src/components/PressQuotes.astro"),
      selfClosing: true,
      attributes: {},
    },
    "photo-gallery": {
      render: component("./src/components/PhotoGalleryBlock.astro"),
      selfClosing: true,
      attributes: {},
    },
    "contact-form": {
      render: component("./src/components/ContactForm.astro"),
      selfClosing: true,
      attributes: {},
    },
  },
});
