import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Image } from "./Image";
import { asImageId, type ImageMetadata } from "@/lib/image-types";

const fixture: ImageMetadata = {
  id: asImageId("abc1234567890def"),
  alt: "A photo",
  width: 1600,
  height: 1067,
  placeholderDataUri: "data:image/webp;base64,UklGRhYAAABXRUJQVlA4TAo=",
  contentSlug: "home",
  originalExt: "jpg",
};

function renderImage(meta: ImageMetadata = fixture, sizes?: string) {
  return renderToStaticMarkup(<Image image={meta} sizes={sizes} />);
}

describe("<Image>", () => {
  it("renders a <picture> with avif and webp <source> tags", () => {
    const html = renderImage();
    expect(html).toMatch(/<picture>/);
    expect(html).toMatch(/type="image\/webp"/);
    expect(html).toMatch(/type="image\/avif"/);
  });

  it("emits all variant widths in srcset", () => {
    const html = renderImage();
    for (const w of [400, 800, 1600]) {
      expect(html).toMatch(new RegExp(`/${w}\\.webp ${w}w`));
    }
  });

  it("includes width and height for CLS", () => {
    const html = renderImage();
    expect(html).toMatch(/width="1600"/);
    expect(html).toMatch(/height="1067"/);
  });

  it("renders alt text", () => {
    const html = renderImage();
    expect(html).toMatch(/alt="A photo"/);
  });

  it("uses provided sizes attribute", () => {
    const html = renderImage(fixture, "(min-width: 768px) 50vw, 100vw");
    expect(html).toMatch(/sizes="\(min-width: 768px\) 50vw, 100vw"/);
  });

  it("inlines the placeholder as background-image", () => {
    const html = renderImage();
    expect(html).toContain("data:image/webp;base64,");
  });

  it("omits variants larger than the source width", () => {
    const small: ImageMetadata = { ...fixture, width: 500, height: 333 };
    const html = renderImage(small);
    expect(html).not.toMatch(/1600w/);
    expect(html).toMatch(/400w/);
  });

  it("uses lazy loading and async decoding", () => {
    const html = renderImage();
    expect(html).toMatch(/loading="lazy"/);
    expect(html).toMatch(/decoding="async"/);
  });
});
