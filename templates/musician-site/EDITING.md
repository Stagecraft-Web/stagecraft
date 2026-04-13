# Editing Guide

This document explains how to manually edit your musician website.

---

## Quick Start

```bash
npm install
npm run dev       # Start dev server at localhost:4321
npm run build     # Production build
npm run preview   # Preview production build
npm run validate:content  # Check content files for errors
```

---

## Content Structure

All site content lives in `src/content/`. This is the only directory you need to edit for routine updates.

```
src/content/
  config/
    site.json       ← Artist name, social links, contact email, copyright
    nav.json        ← Navigation menu items
    theme.json      ← Colors, fonts, spacing
  pages/
    home.mdoc       ← Homepage headline, subheadline, CTA button
    about.mdoc      ← Bio / about page headline and image
    music.mdoc      ← Music page headline and intro text
    photos.mdoc     ← Photos page headline
    press.mdoc      ← Press page headline, reviews heading, EPK link
    contact.mdoc    ← Contact page headline and intro text
  collections/
    releases/       ← One JSON file per album/single/EP
    photos/         ← Photo gallery entries (gallery.json)
    videos/         ← Video embed entries (videos.json)
    pressQuotes/    ← Press quotes (quotes.json)
    tourDates/      ← Tour date entries (dates.json)
```

---

## Singletons

### Site identity — `src/content/config/site.json`

```json
{
  "artistName": "Your Name",
  "siteTitle": "Your Name — Official Website",
  "siteDescription": "Short description for search engines.",
  "socialLinks": {
    "instagram": "https://instagram.com/yourhandle",
    "spotify": "https://open.spotify.com/artist/...",
    "youtube": "",
    "bandcamp": ""
  },
  "contactEmail": "you@example.com",
  "copyright": "© 2026 Your Name. All rights reserved."
}
```

Leave any social link blank (`""`) to hide it from the footer.

### Navigation — `src/content/config/nav.json`

```json
[
  { "label": "Home", "href": "/" },
  { "label": "About", "href": "/about" },
  { "label": "Music", "href": "/music" }
]
```

Add, remove, or reorder entries to change the site navigation.

### Colors and fonts — `src/content/config/theme.json`

Edit the `colors` object to change the palette, and `typography.headingFont` / `typography.bodyFont` for fonts.

After changing `theme.json`, update the matching CSS custom properties in `src/styles/global.css` to match.

---

## Pages

Each page has a Markdoc file (`.mdoc`) with two parts: **frontmatter** (between `---` markers) and **body text** (below).

### Homepage — `src/content/pages/home.mdoc`

```markdown
---
title: Home
headline: Your Name
subheadline: Musician · Performer · Creator
heroImage: /images/hero.jpg
ctaText: Listen Now
ctaLink: /music
---

Welcome text that appears below the hero section.
```

### About — `src/content/pages/about.mdoc`

```markdown
---
title: About
headline: About the Artist
image: /images/about.jpg
---

Your bio goes here. Write as many paragraphs as you like.
Each blank line creates a new paragraph.
```

### Press — `src/content/pages/press.mdoc`

```markdown
---
title: Press
headline: Press & Reviews
reviewsHeadline: Reviews & Press
epkDownload: /downloads/epk.pdf
---

Introductory text for the press page.
```

- `reviewsHeadline` — heading displayed above the press quotes section.
- `epkDownload` — path to your EPK PDF. Remove the line to hide the download button.

---

## Collections

### Add a tour date — `src/content/collections/tourDates/dates.json`

```json
[
  {
    "id": "2026-09-15-venue-name",
    "date": "2026-09-15",
    "venue": "The Venue Name",
    "city": "City, State",
    "ticketUrl": "https://tickets.example.com",
    "status": "upcoming"
  }
]
```

Each entry needs a unique `id` field (e.g. combine the date and venue name).

Valid status values: `upcoming`, `sold_out`, `canceled`, `past`.

### Add a release — `src/content/collections/releases/`

Create a new JSON file, e.g. `new-album.json`:

```json
{
  "title": "Album Title",
  "type": "album",
  "releaseDate": "2026-01-15",
  "coverImage": {
    "src": "/images/cover.jpg",
    "alt": "Album Title cover art",
    "usageSlot": "release-cover"
  },
  "description": "A short description of the release.",
  "links": {
    "spotify": "https://open.spotify.com/album/...",
    "appleMusic": "https://music.apple.com/...",
    "bandcamp": ""
  },
  "tracks": [
    { "title": "Track One", "duration": "3:45" },
    { "title": "Track Two", "duration": "4:12" }
  ]
}
```

Valid type values: `album`, `single`, `ep`.

### Add photos — `src/content/collections/photos/gallery.json`

Place the image in `public/images/`, then add an entry:

```json
[
  {
    "id": "your-photo",
    "src": "/images/your-photo.jpg",
    "alt": "Describe what is in the photo",
    "caption": "Optional display caption",
    "credit": "Photo by Jane Smith",
    "usageSlot": "gallery"
  }
]
```

Each entry needs a unique `id` field.

**`alt` is required** and must describe the image for accessibility and SEO. Never leave it blank.

### Add a video — `src/content/collections/videos/videos.json`

```json
[
  {
    "id": "music-video-title",
    "title": "Music Video Title",
    "url": "https://www.youtube.com/embed/VIDEO_ID",
    "type": "youtube",
    "description": "Optional description."
  }
]
```

Each entry needs a unique `id` field.

Valid type values: `youtube`, `vimeo`, `other`.

### Add a press quote — `src/content/collections/pressQuotes/quotes.json`

```json
[
  {
    "id": "publication-name",
    "quote": "A remarkable debut that showcases genuine artistry.",
    "source": "Publication Name",
    "url": "https://publication.com/review",
    "date": "2024-04-01"
  }
]
```

Each entry needs a unique `id` field.

`url` and `date` are optional.

---

## Image Conventions

All images go in `public/images/`. They are served as-is at `/images/filename.ext`.

### Image metadata (for JSON content files)

Whenever you add an image reference to a JSON content file (releases, photos, etc.), use the full metadata shape:

| Field | Required | Description |
|-------|----------|-------------|
| `src` | yes | Path served from public, e.g. `/images/photo.jpg` |
| `alt` | yes | Descriptive alt text for accessibility |
| `caption` | no | Display caption shown below the image |
| `credit` | no | Photographer or source credit, e.g. `"Photo by Jane Smith"` |
| `focalPoint` | no | `{ "x": 0.5, "y": 0.3 }` — crop hint (0–1 range) |
| `usageSlot` | no | Context hint: `"hero"`, `"about"`, `"release-cover"`, `"gallery"`, etc. |

The SVG placeholders included in the template are for demo purposes only. Replace them with real image files.

---

## Validating Your Changes

After editing any content file, run:

```bash
npm run validate:content
```

This checks all JSON and Markdoc files against their schemas and reports field-level errors. Fix any errors before committing.

---

## Component Reference

| Component | Description |
|-----------|-------------|
| `Button.astro` | Links and buttons (`primary` / `outline` variants) |
| `FormGroup.astro` | Labeled form inputs and textareas |
| `Image.tsx` | Image with loading/error states (React) |
| `Hero.astro` | Full-width hero section |
| `PageHeader.astro` | Page title banner |
| `Header.astro` | Site navigation |
| `Footer.astro` | Footer with social links |
| `ContactForm.astro` | Contact form with spam protection |
| `ReleaseCard.astro` | Music release display card |
| `PhotoGallery.astro` | Photo grid with lightbox |
| `Lightbox.tsx` | Fullscreen image viewer (React) |

---

## Deployment

This site deploys to Netlify. Pushing to `main` triggers a production deploy. Pull requests create preview deploys automatically.
