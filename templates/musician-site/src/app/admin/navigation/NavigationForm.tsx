"use client";

import { AdminPanel } from "@/components/admin/AdminShell";
import {
  CheckboxField,
  ColorField,
  Field,
  FieldGroup,
  SelectField,
  TextField,
} from "@/components/admin/form";
import { ReorderableList } from "@/components/admin/ReorderableList";
import { SaveBar } from "@/components/admin/SaveBar";
import { useSettingsForm } from "@/components/admin/useSettingsForm";
import { ImagePickerField } from "@/puck/ImagePickerField";
import {
  HEADER_LAYOUTS,
  HEADER_LAYOUT_LABELS,
  HEADER_MODES,
  HEADER_MODE_LABELS,
  WORDMARK_SIZE_ADJUSTMENTS,
  WORDMARK_SIZE_ADJUSTMENT_LABELS,
  isTransparentHeader,
  type HeaderConfig,
  type HeaderLayout,
  type HeaderMode,
  type PageSummary,
} from "@/lib/site-config-types";

type Props = {
  initial: HeaderConfig;
  availablePages: PageSummary[];
};

/**
 * Header & Navigation editor. Three groups:
 *   1. Wordmark + sizing — drops in a brand image instead of the artist-name text.
 *   2. Header style — mode, layout, uppercase, subtitle, transparent-mode color.
 *   3. Navigation menu — pick which pages appear and in what order.
 *
 * The nav-items picker reads from the live page list (passed in) so renaming
 * a page or deleting one shows up here automatically.
 */
export function NavigationForm({ initial, availablePages }: Props) {
  const form = useSettingsForm<HeaderConfig>({
    initial,
    endpoint: "/api/save-config",
    kind: "header-config",
  });

  function setField<K extends keyof HeaderConfig>(key: K, val: HeaderConfig[K]) {
    form.setValue((prev) => ({ ...prev, [key]: val }));
  }

  // Pages that exist on disk but aren't in the nav. Excludes splash pages
  // because those override "/" and never want a nav link to themselves.
  const omittedPages = availablePages.filter(
    (p) => !p.isSplashPage && !form.value.items.includes(p.slug),
  );

  const pageTitle = (slug: string) =>
    availablePages.find((p) => p.slug === slug)?.title ?? slug;

  return (
    <AdminPanel
      title="Header & Navigation"
      description="Wordmark, header style (mode + layout), and which pages appear in the navigation menu."
      saveBar={<SaveBar {...form.saveBarProps} />}
    >
      <FieldGroup
        title="Wordmark"
        description="An image shown in the header instead of the artist-name text. Upload here; remove to fall back to the text name from Site Settings."
      >
        <Field
          label="Wordmark image"
          description="PNG / SVG / JPG with transparency. Sized via the slider below."
        >
          <ImagePickerField
            value={form.value.wordmark}
            onChange={(next) => setField("wordmark", next)}
          />
        </Field>
        <SelectField<string>
          id="wordmarkSizeAdjust"
          label="Wordmark size"
          description="Coarse scale tweak for the wordmark image height. Only applies when a wordmark is set."
          value={String(form.value.wordmarkSizeAdjust)}
          options={WORDMARK_SIZE_ADJUSTMENTS.map((v) => ({
            label: WORDMARK_SIZE_ADJUSTMENT_LABELS[String(v)],
            value: String(v),
          }))}
          onChange={(v) => setField("wordmarkSizeAdjust", Number(v) as HeaderConfig["wordmarkSizeAdjust"])}
        />
      </FieldGroup>

      <FieldGroup
        title="Header style"
        description="Mode (solid vs transparent, sticky vs scrolling) and layout (logo + nav arrangement)."
      >
        <SelectField<HeaderMode>
          id="headerMode"
          label="Header mode"
          description="Pick how the header looks and behaves as the page scrolls. Transparent is meant to pair with a page that opens with a fullscreen hero — the nav sits over it and scrolls away."
          value={form.value.headerMode}
          options={HEADER_MODES.map((m) => ({ label: HEADER_MODE_LABELS[m], value: m }))}
          onChange={(v) => setField("headerMode", v)}
        />
        {isTransparentHeader(form.value.headerMode) ? (
          <ColorField
            id="headerForegroundColor"
            label="Header foreground color"
            description="Only used in transparent mode. Pick a color that reads against your hero image. Leave blank to inherit the body text color."
            value={form.value.headerForegroundColor}
            onChange={(v) => setField("headerForegroundColor", v)}
            isOptional
          />
        ) : null}
        <SelectField<HeaderLayout>
          id="headerLayout"
          label="Header layout"
          description="How the logo and navigation are arranged. The two centered variants suit more editorial sites."
          value={form.value.headerLayout}
          options={HEADER_LAYOUTS.map((l) => ({ label: HEADER_LAYOUT_LABELS[l], value: l }))}
          onChange={(v) => setField("headerLayout", v)}
        />
        <CheckboxField
          id="isHeaderTextUppercase"
          label="Uppercase header text"
          description="Renders the artist name in uppercase with slight extra letter-spacing. Only affects the text variant; wordmark images aren't transformed."
          value={form.value.isHeaderTextUppercase}
          onChange={(v) => setField("isHeaderTextUppercase", v)}
        />
        <TextField
          id="headerSubtitle"
          label="Header subtitle (optional)"
          description="Small second line under the artist name — a tagline, location, or role. Hidden automatically when a wordmark image is in use."
          value={form.value.headerSubtitle}
          onChange={(v) => setField("headerSubtitle", v)}
        />
      </FieldGroup>

      <FieldGroup
        title="Navigation menu"
        description="The pages listed below appear in the header navigation, in the order shown. Pages not in this list stay accessible by URL but aren't surfaced in the nav."
      >
        <Field label="Pages in the nav">
          <ReorderableList<string>
            items={form.value.items}
            onChange={(next) => setField("items", next)}
            renderLabel={(slug) => (
              <span>
                <strong>{pageTitle(slug)}</strong>
                <span
                  style={{
                    marginLeft: "var(--space-2)",
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--font-size-xs)",
                  }}
                >
                  /{slug}
                </span>
              </span>
            )}
            emptyState="No pages in the nav yet — pick from below to add one."
          />
        </Field>
        {omittedPages.length > 0 ? (
          <Field label="Add a page to the nav">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-2)",
              }}
            >
              {omittedPages.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setField("items", [...form.value.items, p.slug])}
                  style={{
                    padding: "var(--space-1) var(--space-3)",
                    fontSize: "var(--font-size-sm)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text)",
                    cursor: "pointer",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  + {p.title}
                  <span
                    style={{
                      marginLeft: "var(--space-1)",
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--font-size-xs)",
                    }}
                  >
                    /{p.slug}
                  </span>
                </button>
              ))}
            </div>
          </Field>
        ) : null}
      </FieldGroup>
    </AdminPanel>
  );
}
