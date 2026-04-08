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

function validate(filePath: string, schema: any, isArray = false) {
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

function validateIfExists(filePath: string, schema: any, isArray = false) {
  if (fs.existsSync(filePath)) {
    validate(filePath, schema, isArray);
  }
}

// Config files
validate(path.join(ROOT, "src/content/config/site.json"), siteConfigSchema);
validate(path.join(ROOT, "src/content/config/nav.json"), navSchema);
validate(path.join(ROOT, "src/content/config/theme.json"), themeSchema);

// Collection files
const collectionsDir = path.join(ROOT, "src/content/collections");

// Releases
const releasesDir = path.join(collectionsDir, "releases");
if (fs.existsSync(releasesDir)) {
  for (const file of fs.readdirSync(releasesDir).filter((f) => f.endsWith(".json"))) {
    validate(path.join(releasesDir, file), releaseSchema);
  }
}

// Photos
const photosDir = path.join(collectionsDir, "photos");
if (fs.existsSync(photosDir)) {
  for (const file of fs.readdirSync(photosDir).filter((f) => f.endsWith(".json"))) {
    validate(path.join(photosDir, file), photoSchema, true);
  }
}

// Videos
const videosDir = path.join(collectionsDir, "videos");
if (fs.existsSync(videosDir)) {
  for (const file of fs.readdirSync(videosDir).filter((f) => f.endsWith(".json"))) {
    validate(path.join(videosDir, file), videoSchema, true);
  }
}

// Press quotes
const pressDir = path.join(collectionsDir, "pressQuotes");
if (fs.existsSync(pressDir)) {
  for (const file of fs.readdirSync(pressDir).filter((f) => f.endsWith(".json"))) {
    validate(path.join(pressDir, file), pressQuoteSchema, true);
  }
}

// Tour dates
const tourDir = path.join(collectionsDir, "tourDates");
if (fs.existsSync(tourDir)) {
  for (const file of fs.readdirSync(tourDir).filter((f) => f.endsWith(".json"))) {
    validate(path.join(tourDir, file), tourDateSchema, true);
  }
}

// Report
if (errors.length > 0) {
  console.error("Content validation failed:\n");
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  console.error(`\n${errors.length} error(s) found.`);
  process.exit(1);
} else {
  console.log("✓ All content files valid.");
}
