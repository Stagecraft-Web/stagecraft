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
  homeFrontmatterSchema,
  aboutFrontmatterSchema,
  musicFrontmatterSchema,
  photosFrontmatterSchema,
  pressFrontmatterSchema,
  contactFrontmatterSchema,
} from "../src/lib/schemas.js";
import { parseFrontmatter } from "../src/lib/markdown.js";

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

function validateJsonIfExists(filePath: string, schema: any, isArray = false) {
  if (fs.existsSync(filePath)) {
    validateJson(filePath, schema, isArray);
  }
}

// ============================================================
// Markdown frontmatter validation helpers
// ============================================================

function validateMarkdown(filePath: string, schema: any) {
  const rel = path.relative(ROOT, filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const frontmatter = parseFrontmatter(raw);
    const result = schema.safeParse(frontmatter);
    if (!result.success) {
      result.error.issues.forEach((issue: any) => {
        errors.push(`${rel}: frontmatter.${issue.path.join(".")}: ${issue.message}`);
      });
    }
  } catch (e: any) {
    errors.push(`${rel}: ${e.message}`);
  }
}

function requireFile(filePath: string) {
  const rel = path.relative(ROOT, filePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`${rel}: required file is missing`);
  }
}

// ============================================================
// Path convention checks
// Canonical paths:
//   Singletons:   src/content/config/*.json
//   Pages:        src/content/pages/*.md
//   Collections:  src/content/collections/{name}/*.json
//   Images:       src/assets/images/
// ============================================================

function checkPathConventions() {
  const contentDir = path.join(ROOT, "src/content");
  if (!fs.existsSync(contentDir)) return;

  // Walk src/content/ and flag any JSON/Markdown files outside canonical locations
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT, full);

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const relToContent = path.relative(contentDir, full);
        const parts = relToContent.split(path.sep);

        if (entry.name.endsWith(".json")) {
          // JSON must be in config/ or collections/{name}/
          const topDir = parts[0];
          if (topDir !== "config" && topDir !== "collections") {
            warnings.push(
              `${rel}: JSON content file is outside canonical location (expected src/content/config/ or src/content/collections/{name}/)`
            );
          }
        } else if (entry.name.endsWith(".md")) {
          // Markdown must be in pages/
          const topDir = parts[0];
          if (topDir !== "pages") {
            warnings.push(
              `${rel}: Markdown content file is outside canonical location (expected src/content/pages/)`
            );
          }
        }
      }
    }
  }

  walk(contentDir);
}

// ============================================================
// Required singleton files
// ============================================================

requireFile(path.join(ROOT, "src/content/config/site.json"));
requireFile(path.join(ROOT, "src/content/config/nav.json"));
requireFile(path.join(ROOT, "src/content/config/theme.json"));
requireFile(path.join(ROOT, "src/content/pages/home.md"));
requireFile(path.join(ROOT, "src/content/pages/about.md"));
requireFile(path.join(ROOT, "src/content/pages/music.md"));
requireFile(path.join(ROOT, "src/content/pages/photos.md"));
requireFile(path.join(ROOT, "src/content/pages/press.md"));
requireFile(path.join(ROOT, "src/content/pages/contact.md"));

// ============================================================
// Validate config singletons
// ============================================================

validateJson(path.join(ROOT, "src/content/config/site.json"), siteConfigSchema);
validateJson(path.join(ROOT, "src/content/config/nav.json"), navSchema);
validateJson(path.join(ROOT, "src/content/config/theme.json"), themeSchema);

// ============================================================
// Validate page frontmatter
// ============================================================

validateMarkdown(path.join(ROOT, "src/content/pages/home.md"), homeFrontmatterSchema);
validateMarkdown(path.join(ROOT, "src/content/pages/about.md"), aboutFrontmatterSchema);
validateMarkdown(path.join(ROOT, "src/content/pages/music.md"), musicFrontmatterSchema);
validateMarkdown(path.join(ROOT, "src/content/pages/photos.md"), photosFrontmatterSchema);
validateMarkdown(path.join(ROOT, "src/content/pages/press.md"), pressFrontmatterSchema);
validateMarkdown(path.join(ROOT, "src/content/pages/contact.md"), contactFrontmatterSchema);

// ============================================================
// Validate collections
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
// Path convention check
// ============================================================

checkPathConventions();

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
