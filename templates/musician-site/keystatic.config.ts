import { config, fields, collection, singleton } from "@keystatic/core";
import { block, wrapper } from "@keystatic/core/content-components";

// ---------------------------------------------------------------------------
// Markdoc content components — these appear as insertable blocks in the
// Keystatic Markdoc editor. Tag names here must match markdoc.config.mjs.
// ---------------------------------------------------------------------------

const sectionWrapper = wrapper({
  label: "Section",
  description: "A content section with optional title. Wraps content in a centered container with vertical padding.",
  schema: {
    title: fields.text({ label: "Title" }),
    headingLevel: fields.select({
      label: "Heading Level",
      options: [
        { label: "H1", value: "h1" },
        { label: "H2", value: "h2" },
        { label: "H3", value: "h3" },
        { label: "H4", value: "h4" },
      ],
      defaultValue: "h2",
    }),
    isTitleHidden: fields.checkbox({
      label: "Hide title visually",
      description: "Title is still read by screen readers for accessibility.",
    }),
  },
});

const fullscreenSectionWrapper = wrapper({
  label: "Fullscreen Section",
  description: "A full-viewport section with a background image. Content appears on top of the image.",
  schema: {
    title: fields.text({ label: "Title" }),
    headingLevel: fields.select({
      label: "Heading Level",
      options: [
        { label: "H1", value: "h1" },
        { label: "H2", value: "h2" },
        { label: "H3", value: "h3" },
        { label: "H4", value: "h4" },
      ],
      defaultValue: "h2",
    }),
    isTitleHidden: fields.checkbox({
      label: "Hide title visually",
      description: "Title is still read by screen readers for accessibility.",
    }),
    image: fields.image({
      label: "Background Image",
      directory: "src/assets/images",
      publicPath: "../../assets/images/",
    }),
  },
});

const buttonBlock = block({
  label: "Button",
  description: "A styled button or link.",
  schema: {
    label: fields.text({ label: "Label", validation: { isRequired: true } }),
    href: fields.text({ label: "Link URL" }),
    variant: fields.select({
      label: "Variant",
      options: [
        { label: "Primary", value: "primary" },
        { label: "Outline", value: "outline" },
      ],
      defaultValue: "primary",
    }),
    isExternal: fields.checkbox({ label: "Open in new tab" }),
  },
});

const columnsWrapper = wrapper({
  label: "Columns",
  description: "Side-by-side columns that stack on mobile. Place Column components inside.",
  schema: {
    layout: fields.text({
      label: "Layout",
      description: "Column proportions separated by dashes, e.g. '1-1' (equal), '1-2' (narrow-wide), '2-1' (wide-narrow), '1-1-1' (three equal).",
      defaultValue: "1-1",
    }),
  },
});

const columnWrapper = wrapper({
  label: "Column",
  description: "A single column within a Columns layout.",
  schema: {},
});

const contentImageBlock = block({
  label: "Image",
  description: "An optimized image. Use inside columns or anywhere in page content.",
  schema: {
    src: fields.image({
      label: "Image",
      directory: "src/assets/images",
      publicPath: "../../assets/images/",
      validation: { isRequired: true },
    }),
    alt: fields.text({ label: "Alt Text", validation: { isRequired: true } }),
  },
});

const epkDownloadBlock = block({
  label: "EPK Download",
  schema: {
    path: fields.text({ label: "File Path", validation: { isRequired: true } }),
    label: fields.text({ label: "Button Label" }),
  },
});

const releaseListBlock = block({
  label: "Release List",
  description: "Displays all music releases in a grid.",
  schema: {},
});

const pressQuotesBlock = block({
  label: "Press Quotes",
  description: "Displays all press quotes from the Press Quotes collection.",
  schema: {},
});

const photoGalleryBlock = block({
  label: "Photo Gallery",
  description: "Displays all photos from the Photos collection with lightbox.",
  schema: {},
});

const contactFormBlock = block({
  label: "Contact Form",
  description: "Renders the contact form (name, email, subject, message).",
  schema: {},
});

export default config({
  storage: { kind: "local" },

  singletons: {
    // -----------------------------------------------------------------
    // Config singletons
    // -----------------------------------------------------------------

    siteConfig: singleton({
      label: "Site Settings",
      path: "src/content/config/site",
      format: { data: "json" },
      schema: {
        artistName: fields.text({ label: "Artist Name", validation: { isRequired: true } }),
        siteTitle: fields.text({ label: "Site Title", validation: { isRequired: true } }),
        siteDescription: fields.text({ label: "Site Description", multiline: true }),
        socialLinks: fields.object(
          {
            instagram: fields.text({ label: "Instagram URL" }),
            twitter: fields.text({ label: "Twitter / X URL" }),
            facebook: fields.text({ label: "Facebook URL" }),
            youtube: fields.text({ label: "YouTube URL" }),
            spotify: fields.text({ label: "Spotify URL" }),
            appleMusic: fields.text({ label: "Apple Music URL" }),
            bandcamp: fields.text({ label: "Bandcamp URL" }),
            soundcloud: fields.text({ label: "SoundCloud URL" }),
            tiktok: fields.text({ label: "TikTok URL" }),
          },
          { label: "Social Links" },
        ),
        contactEmail: fields.text({ label: "Contact Email", validation: { isRequired: true } }),
        copyright: fields.text({ label: "Copyright Line" }),
      },
    }),

    // -----------------------------------------------------------------
    // Navigation — owns both membership and order.
    // An ordered array of page references (relationship field).
    // Add a page here to show it in the nav; remove it to hide it.
    // Drag to reorder.
    // -----------------------------------------------------------------

    navigation: singleton({
      label: "Navigation",
      path: "src/content/config/nav",
      format: { data: "json" },
      schema: {
        items: fields.array(
          fields.relationship({ label: "Page", collection: "pages" }),
          {
            label: "Navigation Items",
            itemLabel: (props) => props.value ?? "Select a page",
          },
        ),
      },
    }),
  },

  collections: {
    // -----------------------------------------------------------------
    // Pages — one Markdoc file per page.
    //
    // All pages share minimal frontmatter (title only).
    // Navigation membership is controlled by the Navigation singleton,
    // not by page frontmatter. Page-specific structured content uses
    // Markdoc content components that appear as insertable blocks.
    // -----------------------------------------------------------------

    pages: collection({
      label: "Pages",
      slugField: "title",
      path: "src/content/pages/*",
      format: { contentField: "content" },
      schema: {
        title: fields.slug({ name: { label: "Page Title", validation: { isRequired: true } } }),
        content: fields.markdoc({
          label: "Body Content",
          components: {
            section: sectionWrapper,
            "fullscreen-section": fullscreenSectionWrapper,
            button: buttonBlock,
            columns: columnsWrapper,
            column: columnWrapper,
            "content-image": contentImageBlock,
            "epk-download": epkDownloadBlock,
            "release-list": releaseListBlock,
            "press-quotes": pressQuotesBlock,
            "photo-gallery": photoGalleryBlock,
            "contact-form": contactFormBlock,
          },
        }),
      },
    }),

    // -----------------------------------------------------------------
    // Music releases — one YAML file per release
    // -----------------------------------------------------------------

    releases: collection({
      label: "Releases",
      slugField: "title",
      path: "src/content/collections/releases/*",
      schema: {
        title: fields.slug({ name: { label: "Title", validation: { isRequired: true } } }),
        type: fields.select({
          label: "Type",
          options: [
            { label: "Album", value: "album" },
            { label: "Single", value: "single" },
            { label: "EP", value: "ep" },
          ],
          defaultValue: "album",
        }),
        releaseDate: fields.date({ label: "Release Date", validation: { isRequired: true } }),
        coverImage: fields.object(
          {
            src: fields.image({
              label: "Cover Image",
              directory: "src/assets/images",
              publicPath: "../../../assets/images/",
              validation: { isRequired: true },
            }),
            alt: fields.text({ label: "Alt Text", validation: { isRequired: true } }),
            caption: fields.text({ label: "Caption" }),
            credit: fields.text({ label: "Credit" }),
            usageSlot: fields.select({
              label: "Usage Slot",
              options: [
                { label: "Release Cover", value: "release-cover" },
                { label: "Hero", value: "hero" },
                { label: "Gallery", value: "gallery" },
                { label: "Thumbnail", value: "thumbnail" },
              ],
              defaultValue: "release-cover",
            }),
          },
          { label: "Cover Image" },
        ),
        description: fields.text({ label: "Description", multiline: true }),
        links: fields.object(
          {
            spotify: fields.text({ label: "Spotify URL" }),
            appleMusic: fields.text({ label: "Apple Music URL" }),
            bandcamp: fields.text({ label: "Bandcamp URL" }),
          },
          { label: "Streaming Links" },
        ),
        tracks: fields.array(
          fields.object({
            title: fields.text({ label: "Title", validation: { isRequired: true } }),
            duration: fields.text({ label: "Duration", validation: { isRequired: true } }),
          }),
          {
            label: "Track List",
            itemLabel: (props) => props.fields.title.value || "Track",
          },
        ),
      },
    }),

    // -----------------------------------------------------------------
    // Photos — one YAML file per photo
    // -----------------------------------------------------------------

    photos: collection({
      label: "Photos",
      slugField: "alt",
      path: "src/content/collections/photos/*",
      schema: {
        src: fields.image({
          label: "Photo",
          directory: "src/assets/images",
          publicPath: "../../../assets/images/",
          validation: { isRequired: true },
        }),
        alt: fields.slug({ name: { label: "Alt Text", validation: { isRequired: true } } }),
        caption: fields.text({ label: "Caption" }),
        credit: fields.text({ label: "Credit" }),
        usageSlot: fields.select({
          label: "Usage Slot",
          options: [
            { label: "Gallery", value: "gallery" },
            { label: "Hero", value: "hero" },
            { label: "About", value: "about" },
            { label: "Press", value: "press" },
            { label: "Background", value: "background" },
            { label: "Thumbnail", value: "thumbnail" },
          ],
          defaultValue: "gallery",
        }),
      },
    }),

    // -----------------------------------------------------------------
    // Videos — one YAML file per video
    // -----------------------------------------------------------------

    videos: collection({
      label: "Videos",
      slugField: "title",
      path: "src/content/collections/videos/*",
      schema: {
        title: fields.slug({ name: { label: "Title", validation: { isRequired: true } } }),
        url: fields.url({ label: "Video URL", validation: { isRequired: true } }),
        type: fields.select({
          label: "Platform",
          options: [
            { label: "YouTube", value: "youtube" },
            { label: "Vimeo", value: "vimeo" },
            { label: "Other", value: "other" },
          ],
          defaultValue: "youtube",
        }),
        description: fields.text({ label: "Description", multiline: true }),
      },
    }),

    // -----------------------------------------------------------------
    // Press quotes — one YAML file per quote
    // -----------------------------------------------------------------

    pressQuotes: collection({
      label: "Press Quotes",
      slugField: "source",
      path: "src/content/collections/pressQuotes/*",
      schema: {
        quote: fields.text({ label: "Quote", multiline: true, validation: { isRequired: true } }),
        source: fields.slug({ name: { label: "Source", validation: { isRequired: true } } }),
        url: fields.text({ label: "URL" }),
        date: fields.date({ label: "Date" }),
      },
    }),

    // -----------------------------------------------------------------
    // Tour dates — one YAML file per date
    // -----------------------------------------------------------------

    tourDates: collection({
      label: "Tour Dates",
      slugField: "venue",
      path: "src/content/collections/tourDates/*",
      schema: {
        date: fields.date({ label: "Date", validation: { isRequired: true } }),
        venue: fields.slug({ name: { label: "Venue", validation: { isRequired: true } } }),
        city: fields.text({ label: "City", validation: { isRequired: true } }),
        ticketUrl: fields.url({ label: "Ticket URL" }),
        status: fields.select({
          label: "Status",
          options: [
            { label: "Upcoming", value: "upcoming" },
            { label: "Sold Out", value: "sold_out" },
            { label: "Canceled", value: "canceled" },
            { label: "Past", value: "past" },
          ],
          defaultValue: "upcoming",
        }),
      },
    }),
  },
});
