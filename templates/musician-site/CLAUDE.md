# Editing This Site

This is your musician website. You can edit it through the visual
Keystatic CMS at `/keystatic`, or by editing content files directly.
See `EDITING.md` for step-by-step examples.

## Editing rule of thumb

**Edit content files, not components.** Every piece of content on
your site — bio, headline, CTA text, tour date, release info, photo,
quote — has a field in a file under `src/content/`. That's the
editing surface.

After editing any content file, run:

```bash
npm run validate:content
```

Fix any errors before committing.

## Where content lives

### Singletons

| What                                    | File                                |
| --------------------------------------- | ----------------------------------- |
| Artist name, social links, contact info | `src/content/config/site.json`      |
| Navigation menu (order + which pages)   | `src/content/config/nav.json`       |
| Colors + typography (Google Fonts)      | `src/content/config/appearance.json`|
| Font-size scale, spacing (dev-level)    | `src/content/config/theme.json`     |
| Homepage hero + intro                   | `src/content/pages/home.mdoc`       |
| About page bio + image                  | `src/content/pages/about.mdoc`      |
| Music page + release grid               | `src/content/pages/music.mdoc`      |
| Photos page + gallery                   | `src/content/pages/photos.mdoc`     |
| Press page, reviews, EPK download       | `src/content/pages/press.mdoc`      |
| Contact page + form                     | `src/content/pages/contact.mdoc`    |

### Collections

One YAML file per entry under `src/content/collections/`:

- `releases/` — albums, singles, EPs
- `photos/` — gallery photos
- `videos/` — videos
- `pressQuotes/` — press quotes
- `tourDates/` — tour dates

### Images

All images go in `src/assets/images/`. Astro processes them at build
time — optimised format, content-hashed URLs, automatic dimensions.

In YAML content files, use the full metadata shape:

```yaml
src: ../../../assets/images/your-photo.jpg   # relative path
alt: Describe the image (required — never blank)
caption: Optional display caption
credit: Photo by Jane Smith
```

Relative path prefix depends on where the content file lives:

| Content location                    | Prefix                     |
| ----------------------------------- | -------------------------- |
| `src/content/pages/*.mdoc`          | `../../assets/images/`     |
| `src/content/collections/*/*.yaml`  | `../../../assets/images/`  |

## Page layout

Each `.mdoc` page has frontmatter (only `title` is required) and a
body that uses Markdoc layout tags to structure the page:

- `{% section title="..." %}` — standard titled section.
- `{% fullscreen-section image="..." alt="..." %}` — 100vw × 100vh
  hero with background image.
- `{% columns layout="1-2" %}` + `{% column %}` — side-by-side
  columns (collapses to vertical on mobile).

Content blocks you can drop into any page:

- `{% button label="..." href="..." /%}` — styled CTA.
- `{% content-image src="..." alt="..." /%}` — optimised image.
- `{% release-list /%}` — grid of all releases.
- `{% press-quotes /%}` — list of all press quotes.
- `{% photo-gallery /%}` — gallery with lightbox.
- `{% contact-form /%}` — contact form with spam protection.

See `EDITING.md` for working examples.

## Commands

```bash
npm run dev               # Dev server at localhost:4321
npm run validate:content  # Validate content against schemas
npm run typecheck
npm run build             # Production build (includes typecheck)
npm run test              # vitest unit tests
npm run test:smoke        # Playwright smoke tests (build first)
npm run validate          # All of the above
```

## Keystatic CMS

The visual editor is at `/keystatic`. In local dev it works without
sign-in. For production editing on the deployed site (GitHub OAuth,
Appearance sidebar with live preview), follow
`docs/keystatic-github-setup.md`.
