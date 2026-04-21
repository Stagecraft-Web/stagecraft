import fs from "fs";
import path from "path";
import yaml from "yaml";
import Markdoc from "@markdoc/markdoc";
import {
  siteConfigSchema,
  navConfigSchema,
  themeSchema,
  appearanceSchema,
  pageFrontmatterSchema,
  releaseSchema,
  photoSchema,
  videoSchema,
  pressQuoteSchema,
  tourDateSchema,
  postFrontmatterSchema,
  storeItemSchema,
} from "../src/lib/schemas.js";
import { components as contentComponents } from "../src/content-components/index.js";

const ROOT = path.resolve(import.meta.dirname, "..");
let errors: string[] = [];
let warnings: string[] = [];

// ============================================================
// Validation helpers
// ============================================================

function validateJson(filePath: string, schema: any) {
  const rel = path.relative(ROOT, filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    const result = schema.safeParse(data);
    if (!result.success) {
      result.error.issues.forEach((issue: any) => {
        errors.push(`${rel}: ${issue.path.join(".")}: ${issue.message}`);
      });
    }
  } catch (e: any) {
    errors.push(`${rel}: ${e.message}`);
  }
}

function validateYaml(filePath: string, schema: any) {
  const rel = path.relative(ROOT, filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = yaml.parse(raw);
    const result = schema.safeParse(data);
    if (!result.success) {
      result.error.issues.forEach((issue: any) => {
        errors.push(`${rel}: ${issue.path.join(".")}: ${issue.message}`);
      });
    }
  } catch (e: any) {
    errors.push(`${rel}: ${e.message}`);
  }
}

// ============================================================
// Required singleton files
// ============================================================

function requireFile(filePath: string) {
  const rel = path.relative(ROOT, filePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`${rel}: required file is missing`);
  }
}

requireFile(path.join(ROOT, "src/content/config/site.json"));
requireFile(path.join(ROOT, "src/content/config/nav.json"));
requireFile(path.join(ROOT, "src/content/config/theme.json"));
requireFile(path.join(ROOT, "src/content/config/appearance.json"));

// Page content files — dynamically scan all .mdoc files in pages directory
const pagesDir = path.join(ROOT, "src/content/pages");
if (fs.existsSync(pagesDir)) {
  const pageFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith(".mdoc"));
  if (pageFiles.length === 0) {
    warnings.push("No .mdoc page files found in src/content/pages/");
  }
  for (const file of pageFiles) {
    validatePageFrontmatter(path.join(pagesDir, file));
  }

  // Only one page may be marked as a splash. More than one would make the
  // root route (/) ambiguous — the Astro build would also fail, but this
  // check gives a clearer error before the build runs.
  const splashPages: string[] = [];
  for (const file of pageFiles) {
    const raw = fs.readFileSync(path.join(pagesDir, file), "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    try {
      const data = yaml.parse(fmMatch[1]);
      if (data?.isSplashPage === true) splashPages.push(file);
    } catch {
      // frontmatter parse errors are already reported by validatePageFrontmatter
    }
  }
  if (splashPages.length > 1) {
    errors.push(
      `Multiple splash pages found (${splashPages.join(", ")}). ` +
        `Only one page can have \`isSplashPage: true\` — it takes over \`/\` and displaces home to \`/home\`. ` +
        `Uncheck "Splash page" on all but one.`,
    );
  }
} else {
  errors.push("src/content/pages/: directory is missing");
}

function validatePageFrontmatter(filePath: string) {
  const rel = path.relative(ROOT, filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      errors.push(`${rel}: missing frontmatter block`);
      return;
    }
    const data = yaml.parse(fmMatch[1]);
    const result = pageFrontmatterSchema.safeParse(data);
    if (!result.success) {
      result.error.issues.forEach((issue: any) => {
        errors.push(`${rel}: ${issue.path.join(".")}: ${issue.message}`);
      });
    }
  } catch (e: any) {
    errors.push(`${rel}: ${e.message}`);
  }
}

// ============================================================
// Validate config singletons
// ============================================================

validateJson(path.join(ROOT, "src/content/config/site.json"), siteConfigSchema);
validateJson(path.join(ROOT, "src/content/config/nav.json"), navConfigSchema);
validateJson(path.join(ROOT, "src/content/config/theme.json"), themeSchema);
validateJson(path.join(ROOT, "src/content/config/appearance.json"), appearanceSchema);

// ============================================================
// Custom font name network check
// ============================================================
//
// When the Appearance singleton uses a "custom" font category, the family
// name is a free-text input. Format validation (in appearanceSchema) catches
// obvious typos, but only a real Google Fonts lookup can confirm the name
// actually resolves. We ping the public css2 endpoint — it returns HTTP 400
// with "family '…' not supported" for unknown names, 200 for known ones.
// No API key required.
//
// The check is best-effort: network failures / timeouts issue a warning
// (so offline dev still works) rather than a hard error.

const NETWORK_TIMEOUT_MS = 5000;

async function checkGoogleFontExists(family: string): Promise<{ ok: true } | { ok: false; reason: string } | { ok: null; reason: string }> {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, "+")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) return { ok: true };
    return {
      ok: false,
      reason: `Google Fonts returned ${res.status} — the family name doesn't resolve on fonts.google.com.`,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    // Distinguish network failure from real validation failure so offline dev
    // still passes (it just skips with a warning).
    return {
      ok: null,
      reason: `Couldn't reach fonts.googleapis.com (${message}). Skipping.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function validateCustomFonts() {
  const appearancePath = path.join(ROOT, "src/content/config/appearance.json");
  if (!fs.existsSync(appearancePath)) return;

  const rel = path.relative(ROOT, appearancePath);
  const raw = JSON.parse(fs.readFileSync(appearancePath, "utf-8"));
  const parsed = appearanceSchema.safeParse(raw);
  if (!parsed.success) return; // Already reported by validateJson above.

  const { primary, heading } = parsed.data.typography;
  const customFonts: Array<{ role: string; family: string }> = [];
  if (primary.category === "custom") customFonts.push({ role: "typography.primary", family: primary.family });
  if (heading && heading.category === "custom") {
    customFonts.push({ role: "typography.heading", family: heading.family });
  }

  for (const { role, family } of customFonts) {
    const result = await checkGoogleFontExists(family);
    if (result.ok === true) continue;
    if (result.ok === false) errors.push(`${rel}: ${role}: "${family}" — ${result.reason}`);
    else warnings.push(`${rel}: ${role}: "${family}" — ${result.reason}`);
  }
}

await validateCustomFonts();

// ============================================================
// Validate collections (YAML, one file per entry)
// ============================================================

const collectionsDir = path.join(ROOT, "src/content/collections");

function validateCollection(dirName: string, schema: any) {
  const dir = path.join(collectionsDir, dirName);
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    validateYaml(path.join(dir, file), schema);
  }
}

validateCollection("releases", releaseSchema);
validateCollection("photos", photoSchema);
validateCollection("videos", videoSchema);
validateCollection("pressQuotes", pressQuoteSchema);
validateCollection("tourDates", tourDateSchema);
validateCollection("storeItems", storeItemSchema);

// ============================================================
// Validate posts — .mdoc frontmatter + body in one pass
// ============================================================
//
// Posts are the only collection with rich bodies, so we fall through to the
// generic frontmatter + markdoc validator. The markdoc body pass is shared
// with the pages loop below (validateMdocFiles).

function validatePostFrontmatter(filePath: string) {
  const rel = path.relative(ROOT, filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      errors.push(`${rel}: missing frontmatter block`);
      return;
    }
    const data = yaml.parse(fmMatch[1]);
    const result = postFrontmatterSchema.safeParse(data);
    if (!result.success) {
      result.error.issues.forEach((issue: any) => {
        errors.push(`${rel}: ${issue.path.join(".")}: ${issue.message}`);
      });
    }
  } catch (e: any) {
    errors.push(`${rel}: ${e.message}`);
  }
}

const postsDir = path.join(collectionsDir, "posts");
if (fs.existsSync(postsDir)) {
  for (const file of fs.readdirSync(postsDir).filter((f) => f.endsWith(".mdoc"))) {
    validatePostFrontmatter(path.join(postsDir, file));
  }
}

// ============================================================
// Validate .mdoc files with Markdoc's structural validator
// ============================================================
//
// astro.config.mjs' markdoc.config.ts wraps each tag's `render` path with
// `component(...)` so Astro can resolve it at build time. For structural
// validation we don't need a real render target — we just need the tags'
// attribute schemas so Markdoc.validate can check attribute names, types,
// and required fields. So we build the validator config from the raw
// content-components registry rather than importing markdoc.config.ts
// (which would pull in Astro's `component()` helper, producing an opaque
// ComponentConfig sentinel that Markdoc.validate doesn't understand).
//
// This catches: unknown tag names, missing required attributes, unknown
// attribute names, and attribute type mismatches — exactly the classes of
// error that otherwise surface only at `astro build` time.

function validateMdocFiles(dir: string) {
  if (!fs.existsSync(dir)) return;

  const markdocValidatorConfig = {
    tags: Object.fromEntries(
      contentComponents.map(({ tagName, markdoc }) => [tagName, markdoc]),
    ),
  };

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".mdoc"))) {
    const filePath = path.join(dir, file);
    const rel = path.relative(ROOT, filePath);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const ast = Markdoc.parse(raw);
      const validationErrors = Markdoc.validate(ast, markdocValidatorConfig);
      for (const err of validationErrors) {
        // Only surface warning+ severities; Markdoc emits `debug`/`info` for
        // things the author can't act on (e.g. function calls in attributes).
        if (err.error.level === "debug" || err.error.level === "info") continue;
        const line = err.location?.start?.line;
        const loc = line !== undefined ? `:${line + 1}` : "";
        errors.push(`${rel}${loc}: ${err.error.message}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`${rel}: ${message}`);
    }
  }
}

validateMdocFiles(pagesDir);
validateMdocFiles(postsDir);

// ============================================================
// Report
// ============================================================

if (warnings.length > 0) {
  console.warn("Content validation warnings:\n");
  warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
  console.warn("");
}

if (errors.length > 0) {
  console.error("Content validation failed:\n");
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  console.error(`\n${errors.length} error(s) found.`);
  process.exit(1);
} else {
  console.log(`✓ All content files valid.${warnings.length > 0 ? ` (${warnings.length} warning(s))` : ""}`);
}
