import fs from "fs";
import path from "path";
import yaml from "yaml";
import {
  siteConfigSchema,
  navConfigSchema,
  themeSchema,
  pageFrontmatterSchema,
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
