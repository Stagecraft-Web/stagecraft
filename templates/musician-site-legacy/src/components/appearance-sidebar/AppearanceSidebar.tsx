import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../react/Button";
import FormGroup from "../react/FormGroup";
import { pxToRem } from "../../lib/font-sizing";
import { GOOGLE_FONTS, FONT_WEIGHTS, type GoogleFontCategory } from "../../lib/google-fonts";
import type { FontCategory, FontSizeBucket } from "../../lib/schemas";
import {
  BODY_FONT_SIZE_BUCKETS,
  FONT_CATEGORIES,
  FONT_CATEGORY_LABELS,
  FONT_SIZE_BUCKET_LABELS,
  FONT_SIZE_PX_MAX,
  FONT_SIZE_PX_STEP_MIN,
  HEADING_FONT_SIZE_BUCKETS,
  PX_PER_REM,
} from "../../lib/schemas";
import { checkContrast, type ContrastResult } from "../../lib/color-contrast";
import {
  AuthExpiredError,
  commitFile,
  getBranchHeadOid,
  getGitHubToken,
  getRepoInfo,
  refreshGitHubToken,
} from "./github-client";
import { applyPreview } from "./live-preview";
import { buildCommitMessage, serializeAppearanceForKeystatic } from "./serialize";
import type { AppearanceState, SaveStatus, SidebarConfig } from "./types";
import styles from "./AppearanceSidebar.module.css";

/** Call the local-dev save endpoint. Used when saveMode === "local-api".
 *  The endpoint writes appearance.json to disk and Vite picks up the change. */
async function saveToLocalApi(draft: AppearanceState): Promise<void> {
  const res = await fetch("/api/stagecraft/appearance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: serializeAppearanceForKeystatic(draft),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Save failed (HTTP ${res.status})`);
  }
}

interface Props {
  initialState: AppearanceState;
  config: SidebarConfig;
}

/**
 * AppearanceSidebar — collapsible drawer on the public site that edits
 * appearance.json with live CSS-variable preview and a "Save" that commits
 * to the branch the user is currently editing in Keystatic.
 *
 * Auth: reads Keystatic's `keystatic-gh-access-token` cookie. No cookie →
 * only a "Sign in to edit" button renders (redirects to /keystatic, which
 * handles the OAuth round-trip). Token expires mid-edit → silent refresh
 * via Keystatic's /api/keystatic/github/refresh-token, then retry.
 */
export function AppearanceSidebar({ initialState, config }: Props): ReactElement | null {
  // ==========================================================================
  // Hooks — all declared unconditionally to satisfy the Rules of Hooks. The
  // "should this render at all?" check happens at the bottom.
  // ==========================================================================
  const [token, setToken] = useState<string | null>(() => getGitHubToken());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AppearanceState>(initialState);
  const [committed, setCommitted] = useState<AppearanceState>(initialState);
  const [branches, setBranches] = useState<Array<{ name: string; oid: string }>>([]);
  const [branch, setBranch] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const [repoInfoError, setRepoInfoError] = useState<string | null>(null);

  const [owner, repoName] = useMemo(() => config.repo.split("/"), [config.repo]);

  // Re-project the draft onto the document on every change. CSS-variable
  // writes and single <link href> swap — both cheap and idempotent, so no
  // debounce needed even on rapid keystrokes. `baseFontSizes` is the raw
  // theme.json scale threaded through from BaseLayout — computeFontSizes
  // applies the per-bucket overrides to it for the live preview.
  useEffect(() => {
    applyPreview(document, draft, config.baseFontSizes);
  }, [draft, config.baseFontSizes]);

  useEffect(() => {
    if (!token || config.saveMode !== "github-graphql") return;
    let cancelled = false;
    (async () => {
      try {
        const info = await getRepoInfo(token, owner, repoName);
        if (cancelled) return;
        setBranches(info.branches);
        setBranch((prev) => prev ?? info.defaultBranch);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AuthExpiredError) {
          const refreshed = await refreshGitHubToken();
          if (!cancelled) setToken(refreshed);
        } else {
          setRepoInfoError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, owner, repoName, config.saveMode]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(committed),
    [draft, committed],
  );

  // Recompute on every keystroke — the whole palette is ~10 pairs of cheap
  // floating-point math, no need to debounce.
  const contrastResults = useMemo(() => checkContrast(draft.colors), [draft.colors]);
  const contrastFailures = useMemo(
    () => contrastResults.filter((r) => !r.passes),
    [contrastResults],
  );
  const hasContrastFailure = contrastFailures.length > 0;

  const updateDraft = useCallback(
    (patch: (prev: AppearanceState) => AppearanceState) => {
      setDraft(patch);
      setSaveStatus({ kind: "idle" });
    },
    [],
  );

  const revert = useCallback(() => {
    setDraft(committed);
    setSaveStatus({ kind: "idle" });
  }, [committed]);

  const handleSave = useCallback(async () => {
    setSaveStatus({ kind: "saving" });

    // --- Local save path: just POST to the dev-only Astro endpoint. No
    //     branch, no auth, no commit message — Vite picks up the file
    //     change and HMRs the page.
    if (config.saveMode === "local-api") {
      try {
        await saveToLocalApi(draft);
        setCommitted(draft);
        setSaveStatus({ kind: "saved", commitUrl: null });
      } catch (e) {
        setSaveStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // --- GitHub GraphQL save path: commit to the selected branch using the
    //     token Keystatic stored in a cookie, handle expired-token refresh.
    if (!token || !branch) return;

    const runCommit = async (activeToken: string) => {
      const oid = await getBranchHeadOid(activeToken, owner, repoName, branch);
      if (!oid) throw new Error(`Branch "${branch}" not found.`);
      const { headline, body } = buildCommitMessage(committed, draft);
      return commitFile(activeToken, {
        repoWithOwner: config.repo,
        branch,
        expectedHeadOid: oid,
        path: config.appearancePath,
        contents: serializeAppearanceForKeystatic(draft),
        message: headline,
        description: body,
      });
    };

    try {
      const result = await runCommit(token);
      setCommitted(draft);
      setSaveStatus({ kind: "saved", commitUrl: result.commitUrl });
    } catch (e) {
      if (e instanceof AuthExpiredError) {
        const refreshed = await refreshGitHubToken();
        if (!refreshed) {
          setSaveStatus({ kind: "error", message: "Your sign-in expired. Please sign in again." });
          setToken(null);
          return;
        }
        setToken(refreshed);
        try {
          const result = await runCommit(refreshed);
          setCommitted(draft);
          setSaveStatus({ kind: "saved", commitUrl: result.commitUrl });
        } catch (retryErr) {
          setSaveStatus({
            kind: "error",
            message: retryErr instanceof Error ? retryErr.message : String(retryErr),
          });
        }
        return;
      }
      setSaveStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [token, branch, owner, repoName, config, committed, draft]);

  // ==========================================================================
  // Render
  // ==========================================================================

  // `disabled` means: prod build + local storage mode. Saving can't work
  // (Netlify functions have an ephemeral filesystem), so hide the sidebar.
  if (config.saveMode === "disabled") return null;

  // GitHub mode needs a Keystatic cookie. Show only a sign-in pill until the
  // user authenticates via /keystatic. Local mode has no auth at all — the
  // dev server is assumed to be running on the editor's own machine.
  if (config.saveMode === "github-graphql" && !token) {
    return (
      <div className={styles.signInFab}>
        <a href="/keystatic" className={styles.signInLink}>
          Sign in to edit
        </a>
      </div>
    );
  }

  const isGitHub = config.saveMode === "github-graphql";

  return (
    <>
      {/* Trigger is hidden when the panel is open — the panel header's `×`
          and the footer's Save/Revert buttons take over. The trigger sits
          at z-index 9999 (above the panel) so leaving it visible would
          obscure the bottom-right of the footer (real bug spotted in PR
          review). */}
      {!open && (
        <Button
          variant="unstyled"
          className={styles.trigger}
          onClick={() => setOpen(true)}
          aria-controls="stagecraft-appearance-panel"
        >
          Appearance
        </Button>
      )}

      <aside
        id="stagecraft-appearance-panel"
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        aria-label="Appearance editor"
      >
        <header className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Appearance</h2>
          <Button
            variant="unstyled"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            ariaLabel="Close sidebar"
          >
            ×
          </Button>
        </header>

        <div className={styles.panelBody}>
          {isGitHub && repoInfoError && (
            <div className={styles.errorBanner} role="alert">
              Couldn't load branches: {repoInfoError}
            </div>
          )}

          {isGitHub ? (
            <div className={styles.field}>
              {branches.length === 0 ? (
                // Loading state: stub a single-option select so the layout
                // doesn't jump when branches arrive. FormGroup is self-
                // contained so we feed it a singleton "Loading…" option.
                <FormGroup
                  label="Editing on branch"
                  type="select"
                  selectOptions={[{ label: "Loading…", value: "" }]}
                  value=""
                  onChange={() => {}}
                  isDisabled
                />
              ) : (
                <FormGroup
                  label="Editing on branch"
                  type="select"
                  selectOptions={branches.map((b) => ({ label: b.name, value: b.name }))}
                  value={branch ?? ""}
                  onChange={setBranch}
                />
              )}
              <p className={styles.hint}>
                Commits land on this branch. Use{" "}
                <a href={`/keystatic/branch/${branch ?? "main"}`}>Keystatic</a> to create a new branch
                or open a pull request.
              </p>
            </div>
          ) : (
            <div className={styles.field}>
              <p className={styles.hint}>
                <strong>Local dev mode.</strong> Saves write directly to{" "}
                <code>{config.appearancePath}</code>; Vite picks up the change and refreshes the
                page. In production this sidebar commits to GitHub instead.
              </p>
            </div>
          )}

          <section className={styles.section} aria-labelledby="stagecraft-colors">
            <h3 id="stagecraft-colors" className={styles.sectionTitle}>
              Colors
            </h3>
            <ColorFields
              draft={draft}
              onChange={updateDraft}
              contrastFailures={contrastFailures}
            />
          </section>

          <section className={styles.section} aria-labelledby="stagecraft-typography-body">
            <h3 id="stagecraft-typography-body" className={styles.sectionTitle}>
              Body
            </h3>
            <BodyFields
              draft={draft}
              onChange={updateDraft}
              baseFontSizes={config.baseFontSizes}
            />
          </section>

          <section className={styles.section} aria-labelledby="stagecraft-typography-headings">
            <h3 id="stagecraft-typography-headings" className={styles.sectionTitle}>
              Headings
            </h3>
            <HeadingFields
              draft={draft}
              onChange={updateDraft}
              baseFontSizes={config.baseFontSizes}
            />
          </section>
        </div>

        <footer className={styles.footer}>
          {hasContrastFailure && (
            <div className={styles.contrastBanner} role="alert">
              <strong className={styles.contrastBannerTitle}>Color contrast issues</strong>
              <p className={styles.contrastBannerHint}>
                Fix these before saving. WCAG AA requires 4.5:1 for body text and 3:1 for large
                text.
              </p>
              <ul className={styles.contrastBannerList}>
                {contrastFailures.map((f) => (
                  <li key={f.pair.label}>
                    {f.pair.label}:{" "}
                    {Number.isFinite(f.ratio) ? f.ratio.toFixed(2) : "?"}:1, needs {f.required}:1
                  </li>
                ))}
              </ul>
            </div>
          )}
          {saveStatus.kind === "error" && (
            <div className={styles.errorBanner} role="alert">
              {saveStatus.message}
            </div>
          )}
          {saveStatus.kind === "saved" && (
            <div className={styles.successBanner} role="status">
              Saved.{" "}
              {saveStatus.commitUrl && (
                <a href={saveStatus.commitUrl} target="_blank" rel="noreferrer noopener">
                  View commit
                </a>
              )}
            </div>
          )}
          <div className={styles.footerButtons}>
            <Button
              variant="outline"
              onClick={revert}
              isDisabled={!dirty || saveStatus.kind === "saving"}
            >
              Revert
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isDisabled={
                !dirty ||
                saveStatus.kind === "saving" ||
                // Only github mode needs a branch selected; local mode has
                // no such dependency.
                (isGitHub && !branch) ||
                // Contrast failures hard-block saving — no override. Authors
                // must fix the palette before the Save button becomes active.
                hasContrastFailure
              }
              title={
                hasContrastFailure
                  ? `Fix ${contrastFailures.length} color-contrast issue${contrastFailures.length === 1 ? "" : "s"} before saving.`
                  : undefined
              }
            >
              {saveStatus.kind === "saving" ? "Saving…" : "Save"}
            </Button>
          </div>
        </footer>
      </aside>
    </>
  );
}

// ============================================================================
// Field subcomponents — every labelled select goes through the shared React
// `FormGroup` primitive in `src/components/react/`. The sidebar's own
// chrome (panel, footer, stepper) keeps its locally-scoped styling.
// ============================================================================

interface FieldProps {
  draft: AppearanceState;
  onChange: (patch: (prev: AppearanceState) => AppearanceState) => void;
}

interface SizingFieldProps extends FieldProps {
  baseFontSizes: Record<string, string>;
}

interface ColorFieldsProps extends FieldProps {
  contrastFailures: ContrastResult[];
}

function ColorFields({ draft, onChange, contrastFailures }: ColorFieldsProps) {
  const fields: Array<{ key: keyof AppearanceState["colors"]; label: string }> = [
    { key: "primary", label: "Primary" },
    { key: "secondary", label: "Secondary" },
    { key: "accent", label: "Accent" },
    // Link color is always present in the post-transform state — it either
    // holds the user's explicit override or the fallback to Accent. Render it
    // as a regular editable field; the serialize step decides whether to
    // persist an override or leave linkColor blank in appearance.json.
    { key: "linkColor", label: "Link color" },
    { key: "background", label: "Background" },
    { key: "surface", label: "Surface" },
    { key: "text", label: "Body text" },
    { key: "textMuted", label: "Muted text" },
    { key: "border", label: "Borders" },
  ];

  return (
    <>
      {fields.map(({ key, label }) => {
        // A failure is "because of this color" if this key appears on either
        // side of the pair. That's intentionally broad: if you tweak `text`
        // you want to see the pair that involves it, regardless of whether
        // it's the fg or the bg of that pair. Literal refs can't match.
        const relevantFailures = contrastFailures.filter(
          (f) =>
            ("key" in f.pair.fg && f.pair.fg.key === key) ||
            ("key" in f.pair.bg && f.pair.bg.key === key),
        );
        const setColor = (next: string) =>
          onChange((prev) => ({ ...prev, colors: { ...prev.colors, [key]: next } }));
        return (
          <div className={styles.field} key={key}>
            {/* Two FormGroups sharing one underlying value: the picker
                exposes the OS color UI as a swatch, the text field
                preserves the full CSS value (hex, rgb(), rgba()) so
                people can paste anything. */}
            <div className={styles.colorRow}>
              <FormGroup
                label={`${label} picker`}
                type="color"
                value={toHex(draft.colors[key])}
                onChange={setColor}
              />
              <FormGroup
                label={label}
                type="text"
                value={draft.colors[key]}
                onChange={setColor}
                spellCheck={false}
              />
            </div>
            {relevantFailures.length > 0 && (
              <ul className={styles.contrastBadgeList} aria-live="polite">
                {relevantFailures.map((f) => (
                  <li key={f.pair.label} className={styles.contrastBadge}>
                    {f.pair.label}:{" "}
                    {Number.isFinite(f.ratio) ? f.ratio.toFixed(2) : "?"}:1 / needs {f.required}:1
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}

// Body section — body font, body sizes (xs/sm/base/lg), body weights.
// Sizes precede weights to match the Keystatic admin layout.
function BodyFields({ draft, onChange, baseFontSizes }: SizingFieldProps) {
  const { typography } = draft;
  return (
    <>
      <FontPickerField
        label="Body font"
        value={typography.primary}
        onChange={(next) =>
          onChange((prev) => ({
            ...prev,
            typography: { ...prev.typography, primary: next },
          }))
        }
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Sizes</legend>
        <p className={styles.hint}>
          Step in 1px increments. <code>—</code> means "use the theme.json default".
        </p>
        {BODY_FONT_SIZE_BUCKETS.map((bucket) => (
          <SizeStepperRow
            key={bucket}
            bucket={bucket}
            value={typography.bodySizes[bucket]}
            baseline={baseFontSizes[bucket] ?? ""}
            onChange={(next) =>
              onChange((prev) => ({
                ...prev,
                typography: {
                  ...prev.typography,
                  bodySizes: { ...prev.typography.bodySizes, [bucket]: next },
                },
              }))
            }
          />
        ))}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Weights</legend>
        <p className={styles.hint}>
          Only the weights you pick here are downloaded. Some fonts don't ship every weight —
          check fonts.google.com if a weight looks wrong after saving.
        </p>
        <WeightSelectRow
          label="Body"
          value={typography.bodyWeights.body}
          onChange={(next) =>
            onChange((prev) => ({
              ...prev,
              typography: {
                ...prev.typography,
                bodyWeights: { ...prev.typography.bodyWeights, body: next },
              },
            }))
          }
        />
        <WeightSelectRow
          label="Body bold"
          value={typography.bodyWeights.bodyBold}
          onChange={(next) =>
            onChange((prev) => ({
              ...prev,
              typography: {
                ...prev.typography,
                bodyWeights: { ...prev.typography.bodyWeights, bodyBold: next },
              },
            }))
          }
        />
      </fieldset>
    </>
  );
}

// Headings section — mode (single/split), heading font (when split), heading
// sizes (xl/2xl/3xl/4xl), heading weights (h1..h4). h5/h6 weights are
// intentionally not surfaced; global.css handles them.
function HeadingFields({ draft, onChange, baseFontSizes }: SizingFieldProps) {
  const { typography } = draft;
  return (
    <>
      <FormGroup
        label="Heading font"
        type="select"
        selectOptions={[
          { label: "Same font as body", value: "single" },
          { label: "Different font for headings", value: "split" },
        ]}
        value={typography.mode}
        onChange={(next) =>
          onChange((prev) => {
            const mode = next as "single" | "split";
            if (mode === "single") {
              return { ...prev, typography: { ...prev.typography, mode, heading: null } };
            }
            // Switching to split: seed heading with a reasonable default if
            // one isn't already present.
            const heading =
              prev.typography.heading ??
              ({ category: "serif" as FontCategory, family: "Merriweather" });
            return { ...prev, typography: { ...prev.typography, mode, heading } };
          })
        }
      />

      {typography.mode === "split" && typography.heading && (
        <FontPickerField
          label="Heading font family"
          value={typography.heading}
          onChange={(next) =>
            onChange((prev) => ({
              ...prev,
              typography: { ...prev.typography, heading: next },
            }))
          }
        />
      )}

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Sizes</legend>
        <p className={styles.hint}>
          Step in 1px increments. <code>—</code> means "use the theme.json default".
        </p>
        {HEADING_FONT_SIZE_BUCKETS.map((bucket) => (
          <SizeStepperRow
            key={bucket}
            bucket={bucket}
            value={typography.headingSizes[bucket]}
            baseline={baseFontSizes[bucket] ?? ""}
            onChange={(next) =>
              onChange((prev) => ({
                ...prev,
                typography: {
                  ...prev.typography,
                  headingSizes: { ...prev.typography.headingSizes, [bucket]: next },
                },
              }))
            }
          />
        ))}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Weights</legend>
        {(
          [
            ["h1", "H1"],
            ["h2", "H2"],
            ["h3", "H3"],
            ["h4", "H4"],
          ] as const
        ).map(([key, label]) => (
          <WeightSelectRow
            key={key}
            label={label}
            value={typography.headingWeights[key]}
            onChange={(next) =>
              onChange((prev) => ({
                ...prev,
                typography: {
                  ...prev.typography,
                  headingWeights: { ...prev.typography.headingWeights, [key]: next },
                },
              }))
            }
          />
        ))}
      </fieldset>
    </>
  );
}

// Per-bucket size stepper. Three controls in a row: − button, current value,
// + button. Value is stored as integer pixels (1rem = 16px); the displayed
// label is always the effective rem — when the override is `0`, the stepper
// shows the theme.json baseline and steps from there (so a fresh stepper
// doesn't read as "—" or "0", but as the size the bucket actually renders).
//
// Stepping that lands the value back exactly on the baseline px collapses
// the override to `0` — i.e. the bucket is treated as "use theme.json
// default" again, the value greys out between the +/− buttons, and the
// on-disk JSON loses the redundant override. Authors revert by stepping
// back to the original size; no separate reset button is needed.
//
// FONT_SIZE_PX_STEP_MIN (8px = 0.5rem) is the UI-level floor for stepping
// so the stepper can't dwell on tiny / unrenderable sizes. The schema still
// accepts `0` as the "use baseline" sentinel.
interface SizeStepperRowProps {
  bucket: FontSizeBucket;
  /** Current per-bucket override in pixels. `0` = use baseline. */
  value: number;
  /** rem string from theme.json — used as the starting point when `value === 0`. */
  baseline: string;
  onChange: (next: number) => void;
}

/** Parse a baseline rem string ("1.25rem") to integer pixels. Falls back to
 *  16 for unparseable inputs (e.g. a future theme.json bucket in px or calc()). */
function baselineRemToPx(rem: string): number {
  const match = /^(-?\d+(?:\.\d+)?)rem$/.exec(rem.trim());
  if (!match) return PX_PER_REM;
  return Math.round(Number(match[1]) * PX_PER_REM);
}

function SizeStepperRow({ bucket, value, baseline, onChange }: SizeStepperRowProps) {
  const baselinePx = baselineRemToPx(baseline);
  const isDefault = value === 0;
  const effectivePx = isDefault ? baselinePx : value;
  const next = (delta: 1 | -1) => {
    const candidate = effectivePx + delta;
    const clamped = Math.max(FONT_SIZE_PX_STEP_MIN, Math.min(FONT_SIZE_PX_MAX, candidate));
    // Round-trip back to "use the theme.json default" when the user steps
    // exactly onto the baseline — keeps the on-disk JSON minimal and the
    // muted-grey styling correctly reflects "this bucket inherits".
    onChange(clamped === baselinePx ? 0 : clamped);
  };
  return (
    <div className={styles.fieldRow}>
      <span className={styles.labelInline}>{FONT_SIZE_BUCKET_LABELS[bucket]}</span>
      <div className={styles.stepper}>
        <Button
          variant="unstyled"
          className={styles.stepperButton}
          onClick={() => next(-1)}
          isDisabled={effectivePx <= FONT_SIZE_PX_STEP_MIN}
          ariaLabel={`Decrease ${bucket} size`}
        >
          −
        </Button>
        <output
          className={styles.stepperValue}
          title={isDefault ? `theme.json default: ${baseline}` : `${value}px`}
          data-default={isDefault ? "true" : "false"}
        >
          {pxToRem(effectivePx)}
        </output>
        <Button
          variant="unstyled"
          className={styles.stepperButton}
          onClick={() => next(1)}
          isDisabled={effectivePx >= FONT_SIZE_PX_MAX}
          ariaLabel={`Increase ${bucket} size`}
        >
          +
        </Button>
      </div>
    </div>
  );
}


interface WeightSelectRowProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
}

function WeightSelectRow({ label, value, onChange }: WeightSelectRowProps) {
  return (
    <FormGroup
      label={label}
      type="select"
      selectOptions={FONT_WEIGHTS.map((w) => String(w))}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
    />
  );
}

interface FontPickerProps {
  label: string;
  value: { category: FontCategory; family: string };
  onChange: (next: { category: FontCategory; family: string }) => void;
}

/**
 * Two stacked FormGroups — one for the font's category, one for the family
 * (or, when category === "custom", a free-text input). FormGroup is
 * intentionally self-contained, so we render two distinct labelled groups
 * rather than nesting controls under a single label.
 */
function FontPickerField({ label, value, onChange }: FontPickerProps) {
  // When the user picks a new category, auto-select the first font of that
  // category so the form is always in a valid state. Custom starts empty so
  // the user types a name.
  const handleCategoryChange = (categoryRaw: string) => {
    const category = categoryRaw as FontCategory;
    if (category === "custom") {
      onChange({ category, family: "" });
      return;
    }
    const list = GOOGLE_FONTS[category as GoogleFontCategory];
    onChange({ category, family: list[0]?.family ?? "" });
  };

  return (
    <>
      <FormGroup
        label={`${label} category`}
        type="select"
        selectOptions={FONT_CATEGORIES.map((cat) => ({
          label: FONT_CATEGORY_LABELS[cat],
          value: cat,
        }))}
        value={value.category}
        onChange={handleCategoryChange}
      />
      {value.category === "custom" ? (
        <FormGroup
          label={label}
          type="text"
          placeholder="Space Grotesk"
          value={value.family}
          onChange={(family) => onChange({ category: value.category, family })}
          spellCheck={false}
        />
      ) : (
        <FormGroup
          label={label}
          type="select"
          selectOptions={GOOGLE_FONTS[value.category as GoogleFontCategory].map((f) => f.family)}
          value={value.family}
          onChange={(family) => onChange({ category: value.category, family })}
        />
      )}
    </>
  );
}

/** Coerce any CSS color to a 6-digit hex so <input type="color"> can display
 *  it. Values that can't be trivially coerced (rgba, named colors) fall back
 *  to black in the picker — the paired text input keeps the original value
 *  intact, so nothing is lost. */
function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return "#" + color.slice(1).split("").map((c) => c + c).join("");
  }
  return "#000000";
}
