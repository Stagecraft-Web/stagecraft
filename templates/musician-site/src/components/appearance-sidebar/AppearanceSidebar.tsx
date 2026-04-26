import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { GOOGLE_FONTS, FONT_WEIGHTS, type GoogleFontCategory } from "../../lib/google-fonts";
import type {
  BodyFontSizeBucket,
  FontCategory,
  HeadingFontSizeBucket,
} from "../../lib/schemas";
import {
  BODY_FONT_SIZE_BUCKETS,
  FONT_CATEGORIES,
  FONT_CATEGORY_LABELS,
  FONT_SIZE_BUCKET_LABELS,
  HEADING_FONT_SIZE_BUCKETS,
} from "../../lib/schemas";
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
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="stagecraft-appearance-panel"
      >
        {open ? "Close" : "Appearance"}
      </button>

      <aside
        id="stagecraft-appearance-panel"
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        aria-label="Appearance editor"
      >
        <header className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Appearance</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </header>

        <div className={styles.panelBody}>
          {isGitHub && repoInfoError && (
            <div className={styles.errorBanner} role="alert">
              Couldn't load branches: {repoInfoError}
            </div>
          )}

          {isGitHub ? (
            <FormGroup label="Editing on branch">
              <select
                className={styles.select}
                value={branch ?? ""}
                onChange={(e) => setBranch(e.target.value)}
                disabled={branches.length === 0}
              >
                {branches.length === 0 && <option>Loading…</option>}
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p className={styles.hint}>
                Commits land on this branch. Use{" "}
                <a href={`/keystatic/branch/${branch ?? "main"}`}>Keystatic</a> to create a new branch
                or open a pull request.
              </p>
            </FormGroup>
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
            <ColorFields draft={draft} onChange={updateDraft} />
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
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={revert}
              disabled={!dirty || saveStatus.kind === "saving"}
            >
              Revert
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSave}
              disabled={
                !dirty ||
                saveStatus.kind === "saving" ||
                // Only github mode needs a branch selected; local mode has
                // no such dependency.
                (isGitHub && !branch)
              }
            >
              {saveStatus.kind === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

// ============================================================================
// FormGroup — labelled form-field wrapper. Mirrors the Astro `FormGroup`
// component used elsewhere on the public site (label above input, consistent
// spacing). Lives here rather than in `src/components/` because the sidebar's
// styling is intentionally self-contained — admin chrome shouldn't restyle
// itself when the user changes the site's tokens.
// ============================================================================

interface FormGroupProps {
  label: string;
  children: ReactNode;
  /** Accessible id linking the label to the control inside `children`. */
  htmlFor?: string;
}

function FormGroup({ label, children, htmlFor }: FormGroupProps) {
  const reactId = useId();
  const id = htmlFor ?? reactId;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ============================================================================
// Field subcomponents
// ============================================================================

interface FieldProps {
  draft: AppearanceState;
  onChange: (patch: (prev: AppearanceState) => AppearanceState) => void;
}

interface SizingFieldProps extends FieldProps {
  baseFontSizes: Record<string, string>;
}

function ColorFields({ draft, onChange }: FieldProps) {
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
      {fields.map(({ key, label }) => (
        <div className={styles.field} key={key}>
          <label className={styles.label}>{label}</label>
          <div className={styles.colorRow}>
            {/* <input type="color"> gives us the OS color picker; the text
                input next to it preserves the full CSS value (hex, rgb(),
                rgba()) and lets people paste anything. */}
            <input
              type="color"
              className={styles.colorSwatch}
              value={toHex(draft.colors[key])}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  colors: { ...prev.colors, [key]: e.target.value },
                }))
              }
              aria-label={`${label} (color picker)`}
            />
            <input
              type="text"
              className={styles.colorInput}
              value={draft.colors[key]}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  colors: { ...prev.colors, [key]: e.target.value },
                }))
              }
              aria-label={`${label} (text)`}
              spellCheck={false}
            />
          </div>
        </div>
      ))}
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
          rem values like <code>1.25rem</code>. Leave a field blank to inherit theme.json's default
          (shown as the placeholder).
        </p>
        {BODY_FONT_SIZE_BUCKETS.map((bucket) => (
          <SizeInputRow
            key={bucket}
            bucket={bucket}
            value={typography.bodySizes[bucket]}
            placeholder={baseFontSizes[bucket] ?? ""}
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
          bucket="body"
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
          bucket="bodyBold"
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
      <FormGroup label="Heading font">
        <select
          className={styles.select}
          value={typography.mode}
          onChange={(e) =>
            onChange((prev) => {
              const mode = e.target.value as "single" | "split";
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
        >
          <option value="single">Same font as body</option>
          <option value="split">Different font for headings</option>
        </select>
      </FormGroup>

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
          Per-bucket overrides in rem (e.g. <code>2.5rem</code>). Blank inherits theme.json's
          default.
        </p>
        {HEADING_FONT_SIZE_BUCKETS.map((bucket) => (
          <SizeInputRow
            key={bucket}
            bucket={bucket}
            value={typography.headingSizes[bucket]}
            placeholder={baseFontSizes[bucket] ?? ""}
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
            bucket={key}
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

// Single per-bucket size text input rendered as an inline label/input row to
// keep the eight buckets compact. Empty value means "use the placeholder
// (theme.json baseline)".
interface SizeInputRowProps {
  bucket: BodyFontSizeBucket | HeadingFontSizeBucket;
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
}

function SizeInputRow({ bucket, value, placeholder, onChange }: SizeInputRowProps) {
  const id = useId();
  return (
    <div className={styles.fieldRow}>
      <label className={styles.labelInline} htmlFor={id}>
        {FONT_SIZE_BUCKET_LABELS[bucket]}
      </label>
      <input
        id={id}
        type="text"
        className={styles.textInputCompact}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        inputMode="decimal"
      />
    </div>
  );
}

interface WeightSelectRowProps {
  bucket: string;
  label: string;
  value: number;
  onChange: (next: number) => void;
}

function WeightSelectRow({ bucket, label, value, onChange }: WeightSelectRowProps) {
  const id = useId();
  return (
    <div className={styles.fieldRow}>
      <label className={styles.labelInline} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-bucket={bucket}
      >
        {FONT_WEIGHTS.map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FontPickerProps {
  label: string;
  value: { category: FontCategory; family: string };
  onChange: (next: { category: FontCategory; family: string }) => void;
}

function FontPickerField({ label, value, onChange }: FontPickerProps) {
  // When the user picks a new category, auto-select the first font of that
  // category so the form is always in a valid state. Custom starts empty so
  // the user types a name.
  const handleCategoryChange = (category: FontCategory) => {
    if (category === "custom") {
      onChange({ category, family: "" });
      return;
    }
    const list = GOOGLE_FONTS[category as GoogleFontCategory];
    onChange({ category, family: list[0]?.family ?? "" });
  };

  return (
    <FormGroup label={label}>
      <select
        className={styles.select}
        value={value.category}
        onChange={(e) => handleCategoryChange(e.target.value as FontCategory)}
        aria-label={`${label} category`}
      >
        {FONT_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {FONT_CATEGORY_LABELS[cat]}
          </option>
        ))}
      </select>
      {value.category === "custom" ? (
        <input
          type="text"
          className={styles.textInput}
          placeholder="Space Grotesk"
          value={value.family}
          onChange={(e) => onChange({ category: value.category, family: e.target.value })}
          spellCheck={false}
          aria-label={`${label} family`}
        />
      ) : (
        <select
          className={styles.select}
          value={value.family}
          onChange={(e) => onChange({ category: value.category, family: e.target.value })}
          aria-label={`${label} family`}
        >
          {GOOGLE_FONTS[value.category as GoogleFontCategory].map((f) => (
            <option key={f.family} value={f.family}>
              {f.family}
            </option>
          ))}
        </select>
      )}
    </FormGroup>
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
