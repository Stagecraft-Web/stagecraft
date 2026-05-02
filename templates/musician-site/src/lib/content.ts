import fs from "node:fs/promises";
import path from "node:path";
import type { Data } from "@measured/puck";

import type { BlockProps } from "@/puck/config";

const PAGES_DIR = path.join(process.cwd(), "src/content/pages");

export type PageData = Data<BlockProps>;

export async function readPage(slug: string): Promise<PageData> {
  const file = path.join(PAGES_DIR, `${slug}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as PageData;
}

export async function writePage(slug: string, data: PageData): Promise<void> {
  const file = path.join(PAGES_DIR, `${slug}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
