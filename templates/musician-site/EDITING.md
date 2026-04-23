# Editing Guide

How to edit your site. Two options: the **Keystatic CMS** (visual
editor) or edit files directly.

## Keystatic CMS

Run `npm run dev`, then visit
<http://localhost:4321/keystatic>. You can manage pages, releases,
photos, press quotes, tour dates, and site settings through a web UI.

**In production**, `/keystatic` requires GitHub OAuth — see
[`docs/keystatic-github-setup.md`](docs/keystatic-github-setup.md) for
the one-time setup. Once configured, signed-in editors also see an
**Appearance** button on the live site (bottom-right corner) that
opens a drawer with live-preview color + typography editing and
single-click save.

## Quick start

```bash
npm install
npm run dev               # Dev server at localhost:4321
npm run build             # Production build
npm run validate:content  # Check content files against schemas
```

## Content structure

All site content lives in `src/content/`. This is the only directory
you need to edit for routine updates.

```
src/content/
  config/
    site.json       ← Artist name, social links, contact email
    nav.json        ← Navigation menu order
    appearance.json ← Colors + typography (Google Fonts picker)
    theme.json      ← Font-size scale, spacing, breakpoints
  pages/
    home.mdoc       ← Homepage (fullscreen hero, CTA)
    about.mdoc      ← Bio / about page (image + text)
    music.mdoc      ← Music page intro + release grid
    photos.mdoc     ← Photos page + gallery
    press.mdoc      ← Press page, reviews, EPK link
    contact.mdoc    ← Contact page intro + form
  collections/
    releases/       ← One YAML file per album/single/EP
    photos/         ← One YAML file per photo
    videos/         ← One YAML file per video
    pressQuotes/    ← One YAML file per press quote
    tourDates/      ← One YAML file per tour date
```

---

## Site identity — `src/content/config/site.json`

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

## Navigation — `src/content/config/nav.json`

```json
{ "items": ["home", "about", "music", "photos", "press", "contact"] }
```

An ordered array of page slugs. Add a slug to include it in the nav;
remove to hide. Drag to reorder in Keystatic, or edit the JSON
directly. Nav labels come from each page's `title` field.

## Appearance — `src/content/config/appearance.json`

Edit in Keystatic (Appearance) or by hand. The `<head>` of every
page reads this and injects CSS custom properties plus a Google
Fonts `<link>` that requests only the weights actually in use.

**Typography**

- **Font Strategy**: "Single font for everything" or "Separate heading
  + body fonts".
- **Body / Primary Font**: category-first picker (Sans-serif, Serif,
  Monospace, Display, Handwriting). Each category has a curated list;
  pick **Custom** to type any family from
  [fonts.google.com](https://fonts.google.com).
- **Heading Font**: same picker, only shown in split mode.
- **Font Weights**: pick weights 100–900 per role (body, bodyBold,
  h1–h6). Only selected weights are downloaded.

Example (split mode):

```json
{
  "typography": {
    "primary": { "discriminant": "sans-serif", "value": "Inter" },
    "heading": {
      "discriminant": "split",
      "value": { "discriminant": "serif", "value": "Merriweather" }
    },
    "weights": {
      "body": "400", "bodyBold": "700",
      "h1": "700", "h2": "700", "h3": "700",
      "h4": "700", "h5": "600", "h6": "600"
    }
  }
}
```

Single mode: `"heading": { "discriminant": "single", "value": null }`.

Custom font names are validated — both in format (capitalised, letters
/ digits / spaces) and by pinging Google Fonts during
`npm run validate:content`. A 400 response means the family is
unknown; network failures produce a warning and don't block.

**Colors**

Edit the `colors` object. Any CSS color (`#ffffff`, `rgb(...)`,
`rgba(...)`) works. Field names: `primary`, `secondary`, `accent`,
`background`, `surface`, `text`, `textMuted`, `border`.

## Theme — `src/content/config/theme.json`

Font-size scale, spacing, breakpoints, layout tokens not exposed in
the CMS. These rarely change; edit directly if needed.

---

## Pages

Each page is a Markdoc file (`.mdoc`) with **frontmatter** (between
`---` markers) and **body text** below. Only `title` is required in
frontmatter — it's used for the browser tab and the nav label.

Page layout is built from Markdoc tags in the body:

**Layout**

- `{% section title="..." %}` — standard titled section.
- `{% fullscreen-section image="..." alt="..." %}` — 100vw × 100vh
  hero with a background image.
- `{% columns layout="1-2" %}` + `{% column %}` — side-by-side grid
  (collapses vertically on mobile). Layout strings: `1-1`, `1-2`,
  `2-1`, `1-1-1`.

**Content blocks**

- `{% button label="..." href="..." variant="primary" /%}` — CTA.
  `variant`: `primary` or `outline`. Add `isExternal=true` for
  `target="_blank"`.
- `{% content-image src="..." alt="..." /%}` — optimised image.
- `{% release-list /%}` — grid of every release from the collection.
- `{% press-quotes /%}` — list of every press quote.
- `{% photo-gallery /%}` — gallery with lightbox.
- `{% contact-form /%}` — contact form with spam protection.

### Homepage

```markdoc
---
title: Home
---

{% fullscreen-section image="../../assets/images/hero.jpg" alt="Hero background" %}

# Your Name

Musician · Performer · Creator

{% button label="Listen Now" href="/music" /%}

{% /fullscreen-section %}

{% section %}

Welcome text that appears below the hero section.

{% /section %}
```

### About

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

Your bio goes here. Blank lines create paragraphs.

{% /column %}

{% /columns %}

{% /section %}
```

### Press

```markdoc
---
title: Press
---

{% section title="Press & Reviews" %}

Introductory text for the press page.

{% button label="Download EPK" href="/downloads/epk.pdf" variant="outline" /%}

{% press-quotes /%}

{% /section %}
```

Remove either tag to hide that piece.

### Music

```markdoc
---
title: Music
---

{% section title="Music & Releases" %}

Browse the latest releases below.

{% release-list /%}

{% /section %}
```

### Photos

```markdoc
---
title: Photos
---

{% section title="Photos" %}

{% photo-gallery /%}

{% /section %}
```

### Contact

```markdoc
---
title: Contact
---

{% section title="Get in Touch" %}

Have a booking inquiry or just want to say hello? Fill out the form
and we'll get back to you.

{% contact-form /%}

{% /section %}
```

### Creating a new page

Create a `.mdoc` file in `src/content/pages/`, e.g. `tour-schedule.mdoc`:

```markdoc
---
title: Tour Schedule
---

{% section title="Upcoming Shows" %}

Your content here.

{% /section %}
```

The filename becomes the URL slug (`/tour-schedule`). To show it in
the nav, add its slug to `nav.json` → `items` (or add it via
Keystatic → Navigation).

Pages not listed in the nav stay accessible by URL — useful for
link-in-bio landing pages, etc.

---

## Collections

Each entry is its own YAML file. You can add entries via Keystatic or
by creating files directly.

### Tour date — `src/content/collections/tourDates/`

```yaml
date: "2026-09-15"
venue: The Venue Name
city: City, State
ticketUrl: https://tickets.example.com
status: upcoming   # upcoming | sold_out | canceled | past
```

### Release — `src/content/collections/releases/`

```yaml
title: Album Title
type: album        # album | single | ep
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

### Photo — `src/content/collections/photos/`

Place the image in `src/assets/images/` first, then:

```yaml
src: ../../../assets/images/your-photo.jpg
alt: Describe what's in the photo   # required
caption: Optional display caption
credit: Photo by Jane Smith
usageSlot: gallery
```

### Video — `src/content/collections/videos/`

```yaml
title: Music Video Title
url: https://www.youtube.com/embed/VIDEO_ID
type: youtube      # youtube | vimeo | other
description: Optional description.
```

### Press quote — `src/content/collections/pressQuotes/`

```yaml
quote: A remarkable debut that showcases genuine artistry.
source: Publication Name
url: https://publication.com/review   # optional
date: "2024-04-01"                    # optional
```

---

## Images

Images go in `src/assets/images/`. Astro processes them at build
time — optimised format, content-hashed URLs, automatic dimensions.

Paths in content files are **relative** from the content file to
`src/assets/images/`:

| Content location                    | Prefix                     |
| ----------------------------------- | -------------------------- |
| `src/content/pages/*.mdoc`          | `../../assets/images/`     |
| `src/content/collections/*/*.yaml`  | `../../../assets/images/`  |

YAML content files use the metadata shape:

| Field        | Required | Description                                                     |
| ------------ | -------- | --------------------------------------------------------------- |
| `src`        | yes      | Relative path to image                                          |
| `alt`        | yes      | Descriptive alt text — never blank                              |
| `caption`    | no       | Display caption shown below the image                           |
| `credit`     | no       | Photographer / source, e.g. `"Photo by Jane Smith"`             |
| `focalPoint` | no       | `{ "x": 0.5, "y": 0.3 }` — crop hint (0–1 range)                |
| `usageSlot`  | no       | Context hint: `hero`, `about`, `release-cover`, `gallery`, etc. |

The SVG placeholders in the template are for demo purposes — replace
them with real images.

---

## Validating changes

After any edit, run:

```bash
npm run validate:content
```

It checks every JSON, YAML, and Markdoc file against its schema and
reports field-level errors. Fix errors before committing.

---

## API routes

### `POST /api/contact`

Sends contact-form emails via [Resend](https://resend.com). Requires
`RESEND_API_KEY` set in your environment. Sends to `contactEmail`
from `site.json`. Honeypot + per-IP rate limit (3 req/min) built in.

The `from` address uses Resend's sandbox domain by default — update
it once you've verified a custom domain.

---

## Deployment

Deploys to Netlify. Pushes to `main` trigger production; pull
requests create preview deploys automatically.
