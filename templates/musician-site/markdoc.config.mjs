import { defineMarkdocConfig, component } from "@astrojs/markdoc/config";

export default defineMarkdocConfig({
  tags: {
    hero: {
      render: component("./src/components/Hero.astro"),
      selfClosing: true,
      attributes: {
        headline: { type: String, required: true },
        subheadline: { type: String },
        ctaText: { type: String },
        ctaLink: { type: String },
        image: { type: String },
      },
    },
    "page-image": {
      render: component("./src/components/PageImage.astro"),
      attributes: {
        src: { type: String, required: true },
        alt: { type: String, required: true },
        position: { type: String, default: "left" },
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
  },
});
