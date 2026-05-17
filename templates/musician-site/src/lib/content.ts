import path from "node:path";
import type { Data } from "@measured/puck";

import type { BlockProps } from "@/puck/config";

import {
  contentDir,
  readdirFiltered,
  readJson,
  unlinkIfExists,
  writeJson,
} from "./fs-helpers";
import {
  appearanceSchema,
  DEFAULT_APPEARANCE,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_SITE_CONFIG,
  headerConfigSchema,
  pageRootPropsSchema,
  PAGE_SLUG_PATTERN,
  pageSlugSchema,
  siteConfigSchema,
  type Appearance,
  type HeaderConfig,
  type PageRootProps,
  type PageSummary,
  type SiteConfig,
} from "./site-config-types";

function pagesDir(): string {
  return path.join(contentDir(), "pages");
}
function configDir(): string {
  return path.join(contentDir(), "config");
}

export type PageData = Data<BlockProps>;

export const SITE_CONFIG_REPO_PATH = "src/content/config/site.json";
export const HEADER_CONFIG_REPO_PATH = "src/content/config/header.json";
export const APPEARANCE_REPO_PATH = "src/content/config/appearance.json";

export function pageRepoPath(slug: string): string {
  return `src/content/pages/${slug}.json`;
}

// ---------------------------------------------------------------------------
// Pages (Puck JSON files)
// ---------------------------------------------------------------------------

export async function readPage(slug: string): Promise<PageData> {
  pageSlugSchema.parse(slug);
  const file = path.join(pagesDir(), `${slug}.json`);
  const data = await readJson<PageData>(file);
  if (!data) {
    throw new PageNotFoundError(slug);
  }
  return data;
}

export async function readPageOrNull(slug: string): Promise<PageData | null> {
  try {
    return await readPage(slug);
  } catch (cause) {
    if (cause instanceof PageNotFoundError) return null;
    throw cause;
  }
}

export async function writePage(slug: string, data: PageData): Promise<void> {
  pageSlugSchema.parse(slug);
  await writeJson(path.join(pagesDir(), `${slug}.json`), data);
}

export async function deletePage(slug: string): Promise<void> {
  pageSlugSchema.parse(slug);
  await unlinkIfExists(path.join(pagesDir(), `${slug}.json`));
}

export class PageNotFoundError extends Error {
  constructor(public slug: string) {
    super(`No page with slug "${slug}"`);
    this.name = "PageNotFoundError";
  }
}

export class PageExistsError extends Error {
  constructor(public slug: string) {
    super(`A page with slug "${slug}" already exists`);
    this.name = "PageExistsError";
  }
}

/**
 * Build the starter content for a new page. The Puck root.props carry our
 * page settings; the content array starts with one Heading so the editor
 * isn't empty.
 */
export function emptyPageData(title: string): PageData {
  return {
    content: [
      {
        type: "Heading",
        props: {
          id: `heading-${Date.now()}`,
          text: title,
          level: "h1",
          textAlign: "start",
        },
      },
    ],
    root: { props: { title, isSplashPage: false, isFooterHidden: false } },
  } as PageData;
}

export async function listPageSlugs(): Promise<string[]> {
  return readdirFiltered(pagesDir(), (e) => {
    if (!e.isFile() || !e.name.endsWith(".json")) return null;
    const slug = e.name.replace(/\.json$/, "");
    return PAGE_SLUG_PATTERN.test(slug) ? slug : null;
  });
}

/**
 * Read the root props for a single page, returning normalized defaults when
 * a field is missing. Pages predating per-page settings parse cleanly because
 * every prop defaults.
 */
export function extractPageRootProps(data: PageData): PageRootProps {
  // Puck stores arbitrary root.props; cast and validate to enforce the
  // narrowed shape this template uses.
  const props = (data?.root?.props ?? {}) as Record<string, unknown>;
  return pageRootPropsSchema.parse({
    title: typeof props.title === "string" ? props.title : "Untitled",
    isSplashPage: props.isSplashPage === true,
    isFooterHidden: props.isFooterHidden === true,
  });
}

export async function listPageSummaries(): Promise<PageSummary[]> {
  const [slugs, site] = await Promise.all([listPageSlugs(), readSiteConfig()]);
  const summaries = await Promise.all(
    slugs.map(async (slug) => {
      const data = await readPage(slug);
      const props = extractPageRootProps(data);
      return {
        slug,
        title: props.title,
        isSplashPage: props.isSplashPage,
        isHiddenFromNav: site.hiddenFromNav.includes(slug),
      };
    }),
  );
  return sortSummariesByPageOrder(summaries, site.pageOrder);
}

/**
 * Sort summaries by the canonical `pageOrder` first, then alphabetically for
 * anything not yet ordered (newly-created pages). Splash pages float to the
 * top regardless of where they sit in `pageOrder` so the admin makes the "/"
 * override visible — the user controls splash via the page-root toggle, not
 * via reordering.
 */
function sortSummariesByPageOrder(
  summaries: PageSummary[],
  pageOrder: readonly string[],
): PageSummary[] {
  const orderIndex = new Map(pageOrder.map((slug, idx) => [slug, idx] as const));
  const sorted = [...summaries].sort((a, b) => {
    if (a.isSplashPage !== b.isSplashPage) return a.isSplashPage ? -1 : 1;
    const aIdx = orderIndex.get(a.slug);
    const bIdx = orderIndex.get(b.slug);
    if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
    if (aIdx !== undefined) return -1;
    if (bIdx !== undefined) return 1;
    return a.slug.localeCompare(b.slug);
  });
  return sorted;
}

/**
 * Find the page that owns "/" — either the splash override, or the page with
 * slug "home", or the first available page (fallback for new sites).
 */
export async function resolveRootPageSlug(): Promise<string | null> {
  const summaries = await listPageSummaries();
  const splash = summaries.find((p) => p.isSplashPage);
  if (splash) return splash.slug;
  if (summaries.some((p) => p.slug === "home")) return "home";
  return summaries[0]?.slug ?? null;
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

async function readSingleton<T>(
  file: string,
  parse: (raw: unknown) => T,
  fallback: T,
): Promise<T> {
  const raw = await readJson<unknown>(file);
  if (raw === null) return fallback;
  // Caller's parse() may throw on bad input — let it bubble so the admin
  // surfaces a useful error instead of silently masking it with defaults.
  return parse(raw);
}

export async function readSiteConfig(): Promise<SiteConfig> {
  return readSingleton(
    path.join(configDir(), "site.json"),
    (raw) => siteConfigSchema.parse(raw),
    DEFAULT_SITE_CONFIG,
  );
}

export async function writeSiteConfig(config: SiteConfig): Promise<void> {
  await writeJson(path.join(configDir(), "site.json"), siteConfigSchema.parse(config));
}

export async function readHeaderConfig(): Promise<HeaderConfig> {
  return readSingleton(
    path.join(configDir(), "header.json"),
    (raw) => headerConfigSchema.parse(raw),
    DEFAULT_HEADER_CONFIG,
  );
}

export async function writeHeaderConfig(config: HeaderConfig): Promise<void> {
  await writeJson(path.join(configDir(), "header.json"), headerConfigSchema.parse(config));
}

export async function readAppearance(): Promise<Appearance> {
  return readSingleton(
    path.join(configDir(), "appearance.json"),
    (raw) => appearanceSchema.parse(raw),
    DEFAULT_APPEARANCE,
  );
}

export async function writeAppearance(config: Appearance): Promise<void> {
  await writeJson(path.join(configDir(), "appearance.json"), appearanceSchema.parse(config));
}
