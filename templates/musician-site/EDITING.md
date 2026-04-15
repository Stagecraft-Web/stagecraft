# Editing Guide

This document explains how to edit your musician website. You can either use the **Keystatic CMS** (visual editor) or edit files directly.

---

## Keystatic CMS

The site includes a visual content editor at `/keystatic`. Run the dev server and visit `http://localhost:4321/keystatic` to manage pages, releases, photos, press quotes, tour dates, and site settings through a web UI.

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
    home.mdoc       ← Homepage (fullscreen hero, CTA button)
    about.mdoc      ← Bio / about page (image + text layout)
    music.mdoc      ← Music page intro text + release grid
    photos.mdoc     ← Photos page + gallery
    press.mdoc      ← Press page, reviews, EPK link
    contact.mdoc    ← Contact page intro text + form
  collections/
    releases/       ← One YAML file per album/single/EP
    photos/         ← One YAML file per photo
    videos/         ← One YAML file per video
    pressQuotes/    ← One YAML file per press quote
    tourDates/      ← One YAML file per tour date
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
{
  "items": ["home", "about", "music", "photos", "press", "contact"]
}
```

An ordered array of page slugs. Add a slug to include the page in the nav; remove it to hide it. Drag to reorder in Keystatic (`/keystatic` → Navigation), or edit the JSON directly.

The Navigation singleton is the single source of truth for both nav membership and order. The nav label for each page comes from the page's `title` field.

### Colors and fonts — `src/content/config/theme.json`

Edit the `colors` object to change the palette, and `typography.headingFont` / `typography.bodyFont` for fonts.

After changing `theme.json`, update the matching CSS custom properties in `src/styles/global.css` to match.

---

## Pages

Each page has a Markdoc file (`.mdoc`) with two parts: **frontmatter** (between `---` markers) and **body text** (below).

### Shared frontmatter

All pages have one frontmatter field:

| Field | Required | Description |
|-------|----------|-------------|
| `title` | yes | Page title (used in browser tab and as the nav label) |

Navigation membership is controlled by the Navigation singleton, not by page frontmatter. Page titles/headings displayed on the page itself are handled by the `{% section title="..." %}` Markdoc tag in the body.

### Homepage — `src/content/pages/home.mdoc`

Page-specific structured content uses Markdoc tags in the body. All page layout is fully self-contained in the `.mdoc` file.

```markdoc
---
title: Home
---

{% fullscreen-section image="../../assets/images/hero.jpg" alt="Hero background" %}

# Your Name

Musician - Performer - Creator

{% button href="/music" %}Listen Now{% /button %}

{% /fullscreen-section %}

{% section %}

Welcome text that appears below the hero section.

{% /section %}
```

The `{% fullscreen-section %}` tag renders a 100vw x 100vh section with a background image and content overlay. The `{% button %}` tag renders a styled CTA button.

### About — `src/content/pages/about.mdoc`

```markdoc
---
title: About
---

{% section title="About the Artist" %}

{% columns layout="1-2" %}

{% column %}
{% content-image src="../../assets/images/about.jpg" alt="Artist portrait" /%}
{% /column %}

{% column %}

Your bio goes here. Write as many paragraphs as you like.
Each blank line creates a new paragraph.

{% /column %}

{% /columns %}

{% /section %}
```

The `{% section %}` tag wraps content in a titled section. The `{% columns layout="1-2" %}` tag creates a two-column layout (1:2 ratio). Use `{% content-image %}` for optimised images inside columns.

### Press — `src/content/pages/press.mdoc`

```markdoc
---
title: Press
---

{% section title="Press & Reviews" %}

Introductory text for the press page.

{% epk-download path="/downloads/epk.pdf" label="Download EPK" /%}

{% press-quotes /%}

{% /section %}
```

- The `{% epk-download %}` tag renders a download button. Remove the tag to hide it.
- The `{% press-quotes %}` tag pulls in all quotes from the Press Quotes collection. Remove the tag to hide them.

### Music — `src/content/pages/music.mdoc`

```markdoc
---
title: Music
---

{% section title="Music & Releases" %}

Browse the latest releases and discography below.

{% release-list /%}

{% /section %}
```

- The `{% release-list %}` tag renders all releases from the Releases collection in a grid. It can be inserted into any page.

### Photos — `src/content/pages/photos.mdoc`

```markdoc
---
title: Photos
---

{% section title="Photos" %}

{% photo-gallery /%}

{% /section %}
```

- The `{% photo-gallery %}` tag renders all photos from the Photos collection in a grid with lightbox. It can be inserted into any page.

### Contact — `src/content/pages/contact.mdoc`

```markdoc
---
title: Contact
---

{% section title="Get in Touch" %}

Have a question, booking inquiry, or just want to say hello? Fill out the form below and we'll get back to you.

{% contact-form /%}

{% /section %}
```

- The `{% contact-form %}` tag renders the contact form (name, email, subject, message). It can be inserted into any page.

### Creating a new page

You can create new pages via the Keystatic CMS at `/keystatic` → Pages → "Create new", or by creating a file directly:

1. Create a `.mdoc` file in `src/content/pages/` (e.g. `src/content/pages/tour-schedule.mdoc`):

```markdoc
---
title: Tour Schedule
---

{% section title="Upcoming Shows" %}

Your page content here. Use layout tags (section, fullscreen-section, columns, column) to structure the page and content tags (button, content-image, epk-download, release-list, press-quotes, photo-gallery, contact-form) for content blocks.

{% /section %}
```

2. The page is automatically available at `/tour-schedule` (the filename becomes the URL slug). All page layout is self-contained in the `.mdoc` body -- wrap content in `{% section %}` tags for standard sections or `{% fullscreen-section %}` for hero-style areas.

3. To show the page in navigation, add its slug to the Navigation singleton in Keystatic, or edit `src/content/config/nav.json` directly:

```json
{
  "items": ["home", "tour-schedule", "about", "music", "photos", "press", "contact"]
}
```

Pages not listed in Navigation are still accessible by URL — they just won't appear in the site nav (useful for landing pages, link-in-bio destinations, etc.).

---

## Collections

Each collection entry is a separate YAML file. You can add entries via the Keystatic CMS at `/keystatic` or by creating files directly.

### Add a tour date — `src/content/collections/tourDates/`

Create a new YAML file, e.g. `2026-09-15-venue-name.yaml`:

```yaml
date: "2026-09-15"
venue: The Venue Name
city: City, State
ticketUrl: https://tickets.example.com
status: upcoming
```

Valid status values: `upcoming`, `sold_out`, `canceled`, `past`.

### Add a release — `src/content/collections/releases/`

Create a new YAML file, e.g. `new-album.yaml`:

```yaml
title: Album Title
type: album
releaseDate: "2026-01-15"
coverImage:
  src: ../../../assets/images/cover.jpg
  alt: Album Title cover art
  usageSlot: release-cover
description: A short description of the release.
links:
  spotify: https://open.spotify.com/album/...
  appleMusic: https://music.apple.com/...
  bandcamp: ""
tracks:
  - title: Track One
    duration: "3:45"
  - title: Track Two
    duration: "4:12"
```

Valid type values: `album`, `single`, `ep`.

### Add a photo — `src/content/collections/photos/`

Place the image in `src/assets/images/`, then create a YAML file, e.g. `your-photo.yaml`:

```yaml
src: ../../../assets/images/your-photo.jpg
alt: Describe what is in the photo
caption: Optional display caption
credit: Photo by Jane Smith
usageSlot: gallery
```

**`alt` is required** and must describe the image for accessibility and SEO. Never leave it blank.

### Add a video — `src/content/collections/videos/`

Create a YAML file, e.g. `music-video-title.yaml`:

```yaml
title: Music Video Title
url: https://www.youtube.com/embed/VIDEO_ID
type: youtube
description: Optional description.
```

Valid type values: `youtube`, `vimeo`, `other`.

### Add a press quote — `src/content/collections/pressQuotes/`

Create a YAML file, e.g. `publication-name.yaml`:

```yaml
quote: A remarkable debut that showcases genuine artistry.
source: Publication Name
url: https://publication.com/review
date: "2024-04-01"
```

`url` and `date` are optional.

---

## Image Conventions

All images go in `src/assets/images/`. Astro processes them at build time — optimising formats, adding content hashes, and detecting dimensions automatically.

### Image paths

Image paths in content files are **relative** from the content file to `src/assets/images/`:

| Content location | Relative path prefix |
|-----------------|---------------------|
| `src/content/pages/*.mdoc` | `../../assets/images/` |
| `src/content/collections/*/*.yaml` | `../../../assets/images/` |

### Image metadata (for YAML content files)

Whenever you add an image reference to a YAML content file (releases, photos, etc.), use the full metadata shape:

| Field | Required | Description |
|-------|----------|-------------|
| `src` | yes | Relative path to image in `src/assets/images/` |
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

This checks all JSON, YAML, and Markdoc files against their schemas and reports field-level errors. Fix any errors before committing.

---

## Component Reference

| Component | Description |
|-----------|-------------|
| `Button.astro` | Links and buttons (`primary` / `outline` variants, also Markdoc tag: `{% button %}`) |
| `FormGroup.astro` | Labeled form inputs and textareas |
| `Section.astro` | Section wrapper with optional title (Markdoc tag: `{% section %}`) |
| `FullscreenSection.astro` | Full-viewport hero section with background image (Markdoc tag: `{% fullscreen-section %}`) |
| `Columns.astro` | CSS grid side-by-side layout (Markdoc tag: `{% columns %}`) |
| `Column.astro` | Individual column inside Columns (Markdoc tag: `{% column %}`) |
| `ContentImage.astro` | Optimised image for content areas (Markdoc tag: `{% content-image %}`) |
| `EpkDownload.astro` | EPK download button (Markdoc tag: `{% epk-download %}`) |
| `ReleaseList.astro` | Music releases grid (Markdoc tag: `{% release-list %}`) |
| `PressQuotes.astro` | Press quotes display (Markdoc tag: `{% press-quotes %}`) |
| `PhotoGalleryBlock.astro` | Photo gallery with lightbox (Markdoc tag: `{% photo-gallery %}`) |
| `ContactForm.astro` | Contact form with spam protection (Markdoc tag: `{% contact-form %}`) |
| `Header.astro` | Site navigation |
| `Footer.astro` | Footer with social links |
| `ReleaseCard.astro` | Music release display card |
| `PhotoGallery.astro` | Photo grid with lightbox |
| `Lightbox.tsx` | Fullscreen image viewer (React) |
| `Image.tsx` | Image with loading/error states (React, Lightbox only) |

---

## Deployment

This site deploys to Netlify. Pushing to `main` triggers a production deploy. Pull requests create preview deploys automatically.
