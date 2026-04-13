import { describe, it, expect } from "vitest";
import { classifyEditRequest } from "../classifier";

describe("classifyEditRequest", () => {
  // ── repair ───────────────────────────────────────────────────────────────
  describe("repair", () => {
    it("detects broken/fix language", () => {
      expect(classifyEditRequest("my site is broken")).toBe("repair");
      expect(classifyEditRequest("fix the error on the contact page")).toBe("repair");
      expect(classifyEditRequest("something is not working")).toBe("repair");
    });
  });

  // ── nav_change ───────────────────────────────────────────────────────────
  describe("nav_change", () => {
    it("detects navigation requests", () => {
      expect(classifyEditRequest("reorder the navigation links")).toBe("nav_change");
      expect(classifyEditRequest("add a link to the footer")).toBe("nav_change");
      expect(classifyEditRequest("update the header menu")).toBe("nav_change");
    });
  });

  // ── style_update ─────────────────────────────────────────────────────────
  describe("style_update", () => {
    it("detects style / theme requests", () => {
      expect(classifyEditRequest("change the color scheme to dark blue")).toBe("style_update");
      expect(classifyEditRequest("switch to dark mode")).toBe("style_update");
      expect(classifyEditRequest("update the font to something more modern")).toBe("style_update");
    });
  });

  // ── asset_update ─────────────────────────────────────────────────────────
  describe("asset_update", () => {
    it("detects hero image replacement", () => {
      expect(classifyEditRequest("replace the hero image")).toBe("asset_update");
      expect(classifyEditRequest("swap the banner image for this new one")).toBe("asset_update");
      expect(classifyEditRequest("I want a new hero photo")).toBe("asset_update");
    });

    it("detects gallery photo additions", () => {
      expect(classifyEditRequest("add gallery photos from my last show")).toBe("asset_update");
      expect(classifyEditRequest("upload new photos to the gallery")).toBe("asset_update");
    });

    it("detects press photo requests", () => {
      expect(classifyEditRequest("update my press photo")).toBe("asset_update");
      expect(classifyEditRequest("change the headshot")).toBe("asset_update");
      expect(classifyEditRequest("new press photos from the photoshoot")).toBe("asset_update");
    });

    it("detects logo upload requests", () => {
      expect(classifyEditRequest("upload a new logo")).toBe("asset_update");
      expect(classifyEditRequest("replace the logo")).toBe("asset_update");
      expect(classifyEditRequest("add my band logo")).toBe("asset_update");
    });

    it("detects cover art requests", () => {
      expect(classifyEditRequest("add cover art for the new EP")).toBe("asset_update");
    });

    it("detects profile picture requests", () => {
      expect(classifyEditRequest("update my profile picture")).toBe("asset_update");
    });
  });

  // ── page_add / page_remove ───────────────────────────────────────────────
  describe("page_add / page_remove", () => {
    it("detects add page requests", () => {
      expect(classifyEditRequest("add a new merch page")).toBe("page_add");
      expect(classifyEditRequest("create a new section for my videos")).toBe("page_add");
    });

    it("detects remove page requests", () => {
      expect(classifyEditRequest("remove the press page")).toBe("page_remove");
      expect(classifyEditRequest("delete the tour dates section")).toBe("page_remove");
    });
  });

  // ── widget_update ────────────────────────────────────────────────────────
  describe("widget_update", () => {
    it("detects tour date requests", () => {
      expect(classifyEditRequest("add new tour dates for the summer")).toBe("widget_update");
      expect(classifyEditRequest("update the upcoming shows")).toBe("widget_update");
    });

    it("detects release / music requests", () => {
      expect(classifyEditRequest("add my new album release to the site")).toBe("widget_update");
      expect(classifyEditRequest("my new single is out, please add it")).toBe("widget_update");
    });
  });

  // ── content_edit (fallback) ──────────────────────────────────────────────
  describe("content_edit", () => {
    it("falls back to content_edit for generic text changes", () => {
      expect(classifyEditRequest("update my bio")).toBe("content_edit");
      expect(classifyEditRequest("rewrite the homepage headline")).toBe("content_edit");
      expect(classifyEditRequest("change the contact page email address")).toBe("content_edit");
    });

    it("falls back for unrecognised requests", () => {
      expect(classifyEditRequest("I'd like some changes please")).toBe("content_edit");
    });
  });
});
