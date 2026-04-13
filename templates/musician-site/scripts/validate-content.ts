import fs from "fs";
import path from "path";
import {
  siteConfigSchema,
  navSchema,
  themeSchema,
  releaseSchema,
  photoSchema,
  videoSchema,
  pressQuoteSchema,
  tourDateSchema,
} from "../src/lib/schemas.js";

const ROOT = path.resolve(import.meta.dirname, "..");
let errors: string[] = [];
let warnings: string[] = [];

// ============================================================
// JSON validation helpers
// ============================================================

function validateJson(filePath: string, schema: any, isArray = false) {
  const rel = path.relative(ROOT, filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    if (isArray) {
      if (!Array.isArray(data)) {
        errors.push(`${rel}: expected an array`);
        return;
      }
      data.forEach((item: any, i: number) => {
        const result = schema.safeParse(item);
        if (!result.success) {
          result.error.issues.forEach((issue: any) => {
            errors.push(`${rel}[${i}]: ${issue.path.join(".")}: ${issue.message}`);
          });
        }
      });
    } else {
      const result = schema.safeParse(data);
      if (!result.success) {
        result.error.issues.forEach((issue: any) => {
          errors.push(`${rel}: ${issue.path.join(".")}: ${issue.message}`);
        });
      }
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

// Page content files (validated by Astro content collections at build time,
// but check they exist so validate:content catches missing files early)
requireFile(path.join(ROOT, "src/content/pages/home.mdoc"));
requireFile(path.join(ROOT, "src/content/pages/about.mdoc"));
requireFile(path.join(ROOT, "src/content/pages/music.mdoc"));
requireFile(path.join(ROOT, "src/content/pages/photos.mdoc"));
requireFile(path.join(ROOT, "src/content/pages/press.mdoc"));
requireFile(path.join(ROOT, "src/content/pages/contact.mdoc"));

// ============================================================
// Validate config singletons
// ============================================================

validateJson(path.join(ROOT, "src/content/config/site.json"), siteConfigSchema);
validateJson(path.join(ROOT, "src/content/config/nav.json"), navSchema);
validateJson(path.join(ROOT, "src/content/config/theme.json"), themeSchema);

// ============================================================
// Validate collections
// (Also validated by Astro content collections at build time,
// but this script gives faster feedback without a full build.)
// ============================================================

const collectionsDir = path.join(ROOT, "src/content/collections");

// Releases — one JSON file per release
const releasesDir = path.join(collectionsDir, "releases");
if (fs.existsSync(releasesDir)) {
  for (const file of fs.readdirSync(releasesDir).filter((f) => f.endsWith(".json"))) {
    validateJson(path.join(releasesDir, file), releaseSchema);
  }
}

// Photos — each file is an array of photo entries
const photosDir = path.join(collectionsDir, "photos");
if (fs.existsSync(photosDir)) {
  for (const file of fs.readdirSync(photosDir).filter((f) => f.endsWith(".json"))) {
    validateJson(path.join(photosDir, file), photoSchema, true);
  }
}

// Videos
const videosDir = path.join(collectionsDir, "videos");
if (fs.existsSync(videosDir)) {
  for (const file of fs.readdirSync(videosDir).filter((f) => f.endsWith(".json"))) {
    validateJson(path.join(videosDir, file), videoSchema, true);
  }
}

// Press quotes
const pressDir = path.join(collectionsDir, "pressQuotes");
if (fs.existsSync(pressDir)) {
  for (const file of fs.readdirSync(pressDir).filter((f) => f.endsWith(".json"))) {
    validateJson(path.join(pressDir, file), pressQuoteSchema, true);
  }
}

// Tour dates
const tourDir = path.join(collectionsDir, "tourDates");
if (fs.existsSync(tourDir)) {
  for (const file of fs.readdirSync(tourDir).filter((f) => f.endsWith(".json"))) {
    validateJson(path.join(tourDir, file), tourDateSchema, true);
  }
}

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
