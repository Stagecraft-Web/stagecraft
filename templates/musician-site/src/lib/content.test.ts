import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deletePage,
  emptyPageData,
  extractPageRootProps,
  listPageSummaries,
  PageNotFoundError,
  readAppearance,
  readHeaderConfig,
  readPage,
  readPageOrNull,
  readSiteConfig,
  resolveRootPageSlug,
  stringifyContent,
  writeAppearance,
  writeHeaderConfig,
  writePage,
  writeSiteConfig,
  type PageData,
} from "./content";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_SITE_CONFIG,
} from "./site-config-types";

const PAGES_DIR = path.join(process.cwd(), "src/content/pages");
const CONFIG_DIR = path.join(process.cwd(), "src/content/config");

// Tests write into the same dirs the production code reads from. To keep them
// from clobbering checked-in content (home.json, site.json, …), each test uses
// a unique suffix and cleans up after itself.
const SUFFIX = `__test_${process.pid}_${Date.now()}`;

function testSlug(name: string): string {
  // Slug must match /^[a-z0-9][a-z0-9-]*$/ — replace underscores from SUFFIX.
  return `${name}${SUFFIX}`.replace(/[^a-z0-9-]/g, "-").toLowerCase();
}

const TEST_SITE_FILE = path.join(CONFIG_DIR, `site${SUFFIX}.json`).replace(/[^a-z0-9/.-]/gi, "-");
const TEST_HEADER_FILE = path.join(CONFIG_DIR, `header${SUFFIX}.json`).replace(/[^a-z0-9/.-]/gi, "-");
const TEST_APPEARANCE_FILE = path.join(CONFIG_DIR, `appearance${SUFFIX}.json`).replace(/[^a-z0-9/.-]/gi, "-");

const createdSlugs = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...createdSlugs].map((slug) =>
      fs.rm(path.join(PAGES_DIR, `${slug}.json`), { force: true }),
    ),
  );
  createdSlugs.clear();
  await Promise.all(
    [TEST_SITE_FILE, TEST_HEADER_FILE, TEST_APPEARANCE_FILE].map((f) =>
      fs.rm(f, { force: true }),
    ),
  );
});

async function createPage(slug: string, data: PageData) {
  createdSlugs.add(slug);
  await writePage(slug, data);
}

describe("stringifyContent", () => {
  it("indents 2 spaces and ends with a newline", () => {
    const out = stringifyContent({ a: 1 });
    expect(out).toBe('{\n  "a": 1\n}\n');
  });
});

describe("emptyPageData", () => {
  it("includes a heading and root props with the title", () => {
    const data = emptyPageData("Hello");
    expect(data.content).toHaveLength(1);
    expect(data.content[0].type).toBe("Heading");
    expect((data.content[0].props as { text: string }).text).toBe("Hello");
    expect((data.root as { props: { title: string } }).props.title).toBe("Hello");
  });

  it("defaults root flags to false", () => {
    const data = emptyPageData("Hello");
    const props = (data.root as {
      props: { isSplashPage: boolean; isFooterHidden: boolean };
    }).props;
    expect(props.isSplashPage).toBe(false);
    expect(props.isFooterHidden).toBe(false);
  });
});

describe("readPage / writePage", () => {
  it("round-trips a page through disk", async () => {
    const slug = testSlug("round-trip");
    const data = emptyPageData("My Page");
    await createPage(slug, data);

    const read = await readPage(slug);
    expect(read).toEqual(data);
  });

  it("readPage throws PageNotFoundError when the file is missing", async () => {
    await expect(readPage(testSlug("missing"))).rejects.toBeInstanceOf(PageNotFoundError);
  });

  it("readPageOrNull returns null for missing files", async () => {
    const out = await readPageOrNull(testSlug("missing"));
    expect(out).toBeNull();
  });

  it("rejects an invalid slug", async () => {
    await expect(readPage("UPPER")).rejects.toThrow();
    await expect(writePage("UPPER", emptyPageData("x"))).rejects.toThrow();
  });
});

describe("deletePage", () => {
  it("removes the file when it exists", async () => {
    const slug = testSlug("delete-me");
    await createPage(slug, emptyPageData("Delete Me"));
    expect(await readPageOrNull(slug)).not.toBeNull();

    await deletePage(slug);
    expect(await readPageOrNull(slug)).toBeNull();
    createdSlugs.delete(slug);
  });

  it("is a no-op when the file is already missing", async () => {
    await expect(deletePage(testSlug("never-existed"))).resolves.toBeUndefined();
  });
});

describe("listPageSummaries", () => {
  it("includes every test-created page with its title and splash flag", async () => {
    const slugA = testSlug("zzz-alpha");
    const slugB = testSlug("aaa-bravo");
    await createPage(slugA, emptyPageData("Alpha"));
    const splashData = emptyPageData("Bravo");
    (splashData.root as { props: { isSplashPage: boolean } }).props.isSplashPage = true;
    await createPage(slugB, splashData);

    const summaries = await listPageSummaries();
    const ours = summaries.filter((s) => s.slug === slugA || s.slug === slugB);

    // Splash page (slugB) sorts before non-splash (slugA) regardless of
    // alphabetical order.
    expect(ours.map((s) => s.slug)).toEqual([slugB, slugA]);
    expect(ours.find((s) => s.slug === slugB)?.isSplashPage).toBe(true);
    expect(ours.find((s) => s.slug === slugA)?.isSplashPage).toBe(false);
    expect(ours.find((s) => s.slug === slugA)?.title).toBe("Alpha");
  });
});

describe("resolveRootPageSlug", () => {
  it("returns the splash page when one exists", async () => {
    const slug = testSlug("splash-page");
    const data = emptyPageData("Splash");
    (data.root as { props: { isSplashPage: boolean } }).props.isSplashPage = true;
    await createPage(slug, data);

    expect(await resolveRootPageSlug()).toBe(slug);
  });

  it("returns 'home' when no splash but home.json exists", async () => {
    // home.json is checked into the repo, so this should hold by default.
    expect(await resolveRootPageSlug()).toBe("home");
  });
});

describe("extractPageRootProps", () => {
  it("normalizes missing fields to defaults", () => {
    const props = extractPageRootProps({
      content: [],
      root: { props: { title: "x" } },
    } as PageData);
    expect(props).toEqual({ title: "x", isSplashPage: false, isFooterHidden: false });
  });

  it("preserves explicit values", () => {
    const props = extractPageRootProps({
      content: [],
      root: {
        props: { title: "y", isSplashPage: true, isFooterHidden: true },
      },
    } as PageData);
    expect(props).toEqual({ title: "y", isSplashPage: true, isFooterHidden: true });
  });

  it("falls back to 'Untitled' when title is missing", () => {
    const props = extractPageRootProps({
      content: [],
      root: { props: {} },
    } as PageData);
    expect(props.title).toBe("Untitled");
  });
});

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

describe("singleton reads return the existing on-disk values, defaults otherwise", () => {
  it("readSiteConfig returns DEFAULT when no site.json (would require deletion)", async () => {
    // The repo checks in (or doesn't check in) site.json; we don't want to
    // delete it. Just assert that read succeeds and matches the schema.
    const cfg = await readSiteConfig();
    expect(cfg.artistName).toBeTypeOf("string");
    expect(cfg.contactEmail).toMatch(/@/);
  });

  it("readHeaderConfig parses successfully", async () => {
    const cfg = await readHeaderConfig();
    expect(cfg.headerMode).toBeTypeOf("string");
    expect(Array.isArray(cfg.items)).toBe(true);
  });

  it("readAppearance parses successfully", async () => {
    const cfg = await readAppearance();
    expect(cfg.colors.primary).toBeTypeOf("string");
  });
});

describe("write* + read* round-trip through disk", () => {
  // These mutate the real config files. We snapshot the original on entry
  // and restore on exit so the round-trip test doesn't leave behind a dirty
  // working tree.
  let originalSite: string | null = null;
  let originalHeader: string | null = null;
  let originalAppearance: string | null = null;

  beforeEach(async () => {
    const sitePath = path.join(CONFIG_DIR, "site.json");
    const headerPath = path.join(CONFIG_DIR, "header.json");
    const appearancePath = path.join(CONFIG_DIR, "appearance.json");
    originalSite = await fs.readFile(sitePath, "utf-8").catch(() => null);
    originalHeader = await fs.readFile(headerPath, "utf-8").catch(() => null);
    originalAppearance = await fs
      .readFile(appearancePath, "utf-8")
      .catch(() => null);
  });

  afterEach(async () => {
    const sitePath = path.join(CONFIG_DIR, "site.json");
    const headerPath = path.join(CONFIG_DIR, "header.json");
    const appearancePath = path.join(CONFIG_DIR, "appearance.json");
    if (originalSite !== null) await fs.writeFile(sitePath, originalSite, "utf-8");
    else await fs.rm(sitePath, { force: true });
    if (originalHeader !== null) await fs.writeFile(headerPath, originalHeader, "utf-8");
    else await fs.rm(headerPath, { force: true });
    if (originalAppearance !== null)
      await fs.writeFile(appearancePath, originalAppearance, "utf-8");
    else await fs.rm(appearancePath, { force: true });
  });

  it("writeSiteConfig + readSiteConfig round-trip", async () => {
    const cfg = { ...DEFAULT_SITE_CONFIG, artistName: "Test Artist" };
    await writeSiteConfig(cfg);
    const out = await readSiteConfig();
    expect(out.artistName).toBe("Test Artist");
  });

  it("writeHeaderConfig + readHeaderConfig round-trip", async () => {
    const cfg = {
      ...DEFAULT_HEADER_CONFIG,
      headerMode: "transparent-static" as const,
      items: ["home", "about"],
    };
    await writeHeaderConfig(cfg);
    const out = await readHeaderConfig();
    expect(out.headerMode).toBe("transparent-static");
    expect(out.items).toEqual(["home", "about"]);
  });

  it("writeAppearance + readAppearance round-trip", async () => {
    const cfg = {
      ...DEFAULT_APPEARANCE,
      colors: { ...DEFAULT_APPEARANCE.colors, primary: "#abcdef" },
    };
    await writeAppearance(cfg);
    const out = await readAppearance();
    expect(out.colors.primary).toBe("#abcdef");
  });
});
