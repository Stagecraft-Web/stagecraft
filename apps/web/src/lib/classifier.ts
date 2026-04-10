import type { EditMode } from "@stagecraft/shared";

const RULES: Array<{ mode: EditMode; patterns: RegExp[] }> = [
  {
    mode: "repair",
    patterns: [
      /\b(fix|broken|error|bug|issue|problem|wrong|incorrect|not working|crash|fail)\b/i,
      /\b(repair|restore|reset)\b/i,
    ],
  },
  {
    mode: "nav_change",
    patterns: [
      /\b(nav|navigation|menu|header|footer|link|links)\b/i,
    ],
  },
  {
    mode: "style_update",
    patterns: [
      /\b(color|colour|theme|font|typography|style|design|look|appearance|dark mode|light mode)\b/i,
      /\b(background|foreground|accent|primary|secondary|palette|brand)\b/i,
    ],
  },
  {
    mode: "page_add",
    patterns: [
      /\b(add|create|new)\b.{0,20}\b(page|section)\b/i,
      /\b(page|section)\b.{0,20}\b(add|create|new)\b/i,
    ],
  },
  {
    mode: "page_remove",
    patterns: [
      /\b(remove|delete|hide|drop)\b.{0,20}\b(page|section)\b/i,
      /\b(page|section)\b.{0,20}\b(remove|delete|hide)\b/i,
    ],
  },
  {
    mode: "asset_update",
    patterns: [
      /\b(photo|image|picture|artwork|cover art|banner|logo|headshot|press photo)\b/i,
      /\b(gallery|photos|images|upload|artwork)\b/i,
    ],
  },
  {
    mode: "widget_update",
    patterns: [
      /\b(tour|dates|shows|gigs|events|tickets|venue)\b/i,
      /\b(video|videos|youtube|vimeo|stream|embed)\b/i,
      /\b(release|album|track|music|song|ep|single|record)\b/i,
      /\b(social|instagram|twitter|spotify|bandcamp|soundcloud|apple music)\b/i,
    ],
  },
  {
    mode: "content_edit",
    patterns: [
      /\b(bio|about|description|text|copy|words|write|rewrite|update|change|edit)\b/i,
      /\b(headline|tagline|title|subtitle|blurb|name|contact|info)\b/i,
      /\b(press quote|quote|testimonial|homepage|home page|about page)\b/i,
    ],
  },
];

/**
 * Classify a plain-language edit request into a scoped EditMode.
 * Rules are evaluated in priority order (repair > nav > style > ... > content).
 * Falls back to "content_edit" if no pattern matches.
 */
export function classifyEditRequest(requestText: string): EditMode {
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(requestText))) {
      return rule.mode;
    }
  }
  return "content_edit";
}
