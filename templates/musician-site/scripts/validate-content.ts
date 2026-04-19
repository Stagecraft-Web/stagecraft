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
