# Editing Guide

This document explains how to manually edit your musician website.

## Quick Start

```bash
npm install
npm run dev       # Start dev server at localhost:4321
npm run build     # Production build
npm run preview   # Preview production build
```

## Content Structure

All site content lives in `src/content/`:

```
src/content/
  config/
    site.json       ← Artist name, social links, contact email
    nav.json        ← Navigation menu items
    theme.json      ← Colors, fonts, spacing
  pages/
    home.md         ← Homepage headline, intro text
    about.md        ← Bio / about page
    music.md        ← Music page intro
    press.md        ← Press page intro, EPK link
    contact.md      ← Contact page intro
  collections/
    releases/       ← Album/single/EP entries (JSON)
    photos/         ← Photo gallery entries (JSON)
    videos/         ← Video embed entries (JSON)
    pressQuotes/    ← Press quotes (JSON)
    tourDates/      ← Tour date entries (JSON)
```

## Common Edits

### Update your bio
Edit `src/content/pages/about.md`. The text below the `---` frontmatter block is your bio content.

### Add a tour date
Edit `src/content/collections/tourDates/dates.json`. Add a new entry:
```json
{
  "date": "2026-09-15",
  "venue": "The Venue Name",
  "city": "City, State",
  "ticketUrl": "https://tickets.example.com",
  "status": "upcoming"
}
```

### Add photos
1. Place the image file in `src/assets/images/`.
2. Add an entry in `src/content/collections/photos/gallery.json`:
```json
{
  "src": "/src/assets/images/your-photo.jpg",
  "alt": "Description of the photo",
  "caption": "Optional caption"
}
```

### Add a new release
Create a new JSON file in `src/content/collections/releases/`, e.g. `new-album.json`:
```json
{
  "title": "Album Title",
  "type": "album",
  "releaseDate": "2026-01-15",
  "coverImage": "/src/assets/images/cover.jpg",
  "description": "Description of the release.",
  "links": {
    "spotify": "https://...",
    "appleMusic": "https://..."
  },
  "tracks": [
    { "title": "Track 1", "duration": "3:45" }
  ]
}
```

### Change colors or fonts
Edit `src/content/config/theme.json`. The `colors` object controls the site palette, and `typography` controls fonts.

### Change navigation
Edit `src/content/config/nav.json`. Each entry has a `label` (display text) and `href` (URL path).

## Images
- Place source images in `src/assets/images/`
- Astro optimizes images at build time
- Always provide alt text for accessibility

## Deployment
This site deploys to Netlify. Pushing to `main` triggers a production deploy. Pull requests create preview deploys.
