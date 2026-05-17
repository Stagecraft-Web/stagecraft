import { Render } from "@measured/puck";
import "@measured/puck/puck.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import {
  extractPageRootProps,
  listPageSummaries,
  readHeaderConfig,
  readPageOrNull,
  readSiteConfig,
  resolveRootPageSlug,
} from "@/lib/content";
import { pageSlugSchema } from "@/lib/site-config-types";
import { puckConfig } from "@/puck/config";

type Props = {
  params: Promise<{ slug?: string[] }>;
};

/**
 * Catch-all renderer for every public URL.
 *
 *   /             → splash page (if marked) → /home → first page
 *   /<slug>       → src/content/pages/<slug>.json
 *
 * Unknown slugs render the framework 404 page. Splash pages take over `/`
 * and skip the Header + Footer (the splash is supposed to fill the viewport).
 *
 * Site-wide config (artist name + nav) feeds the Header; per-page root
 * props (isFooterHidden, isSplashPage) control the chrome around the body.
 */
export default async function CatchAllPage({ params }: Props) {
  const { slug: segments } = await params;

  // Resolve the requested slug. No segments = root URL = splash or home.
  let requestedSlug: string;
  if (!segments || segments.length === 0) {
    const root = await resolveRootPageSlug();
    if (!root) notFound();
    requestedSlug = root;
  } else if (segments.length === 1) {
    const parsed = pageSlugSchema.safeParse(segments[0]);
    if (!parsed.success) notFound();
    requestedSlug = parsed.data;
  } else {
    // Nested URLs (/news/post-slug) aren't supported by the template yet —
    // fall through to 404.
    notFound();
  }

  const [pageData, site, header, summaries] = await Promise.all([
    readPageOrNull(requestedSlug),
    readSiteConfig(),
    readHeaderConfig(),
    listPageSummaries(),
  ]);

  if (!pageData) notFound();

  const rootProps = extractPageRootProps(pageData);
  const pageTitleBySlug = new Map(summaries.map((s) => [s.slug, s.title]));

  // Footer visibility: hidden if either the site-level toggle OR the
  // per-page toggle says hidden. Splash pages always hide both chrome
  // pieces because they're standalone full-bleed landings.
  const hideFooter = rootProps.isSplashPage || site.isFooterHidden || rootProps.isFooterHidden;
  const hideHeader = rootProps.isSplashPage;

  return (
    <>
      {hideHeader ? null : (
        <Header
          artistName={site.artistName}
          header={header}
          pageTitleBySlug={pageTitleBySlug}
        />
      )}
      <main>
        <Render config={puckConfig} data={pageData} />
      </main>
      {hideFooter ? null : <Footer site={site} />}
    </>
  );
}

/**
 * Per-page metadata (document title + meta description). Reads from site
 * config + the page's own root.title so each route surfaces a meaningful
 * tab name.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: segments } = await params;
  const slug = !segments || segments.length === 0
    ? await resolveRootPageSlug()
    : segments[0];

  if (!slug) return { title: "Site" };

  const [site, pageData] = await Promise.all([
    readSiteConfig(),
    readPageOrNull(slug),
  ]);

  const pageTitle = pageData ? extractPageRootProps(pageData).title : null;
  return {
    title: pageTitle ? `${pageTitle} — ${site.artistName}` : site.siteTitle,
    description: site.siteDescription,
  };
}
