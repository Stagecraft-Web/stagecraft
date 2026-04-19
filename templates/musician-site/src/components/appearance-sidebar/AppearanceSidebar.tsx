import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GOOGLE_FONTS, FONT_WEIGHTS, type GoogleFontCategory } from "../../lib/google-fonts";
import type { FontCategory } from "../../lib/schemas";
import { FONT_CATEGORIES } from "../../lib/schemas";
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
  // debounce needed even on rapid keystrokes.
  useEffect(() => {
    applyPreview(document, draft);
  }, [draft]);

  useEffect(() => {
    if (!token || config.storageMode !== "github") return;
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
  }, [token, owner, repoName, config.storageMode]);

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
    if (!token || !branch) return;
    setSaveStatus({ kind: "saving" });

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

  // Don't render anything in local mode — the sidebar is only useful against
  // a GitHub-backed Keystatic. In dev, use Keystatic's admin UI at /keystatic.
  if (config.storageMode !== "github") return null;

  // Unauthenticated: show a small "sign in" pill. Clicking it routes the
  // user through Keystatic's OAuth (Keystatic's /keystatic route does this
  // for us).
  if (!token) {
    return (
      <div className={styles.signInFab}>
        <a href="/keystatic" className={styles.signInLink}>
          Sign in to edit
        </a>
      </div>
    );
  }

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

        {repoInfoError && (
          <div className={styles.errorBanner} role="alert">
            Couldn't load branches: {repoInfoError}
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="stagecraft-branch">
            Editing on branch
          </label>
          <select
            id="stagecraft-branch"
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
        </div>

        <section className={styles.section} aria-labelledby="stagecraft-colors">
          <h3 id="stagecraft-colors" className={styles.sectionTitle}>
            Colors
          </h3>
          <ColorFields draft={draft} onChange={updateDraft} />
        </section>

        <section className={styles.section} aria-labelledby="stagecraft-typography">
          <h3 id="stagecraft-typography" className={styles.sectionTitle}>
            Typography
          </h3>
          <TypographyFields draft={draft} onChange={updateDraft} />
        </section>

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
              disabled={!dirty || saveStatus.kind === "saving" || !branch}
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
// Field subcomponents
// ============================================================================

interface FieldProps {
  draft: AppearanceState;
  onChange: (patch: (prev: AppearanceState) => AppearanceState) => void;
}

function ColorFields({ draft, onChange }: FieldProps) {
  const fields: Array<{ key: keyof AppearanceState["colors"]; label: string }> = [
    { key: "primary", label: "Primary" },
    { key: "secondary", label: "Secondary" },
    { key: "accent", label: "Accent" },
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

function TypographyFields({ draft, onChange }: FieldProps) {
  const { typography } = draft;
  return (
    <>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="stagecraft-font-mode">
          Headings
        </label>
        <select
          id="stagecraft-font-mode"
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
      </div>

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

      {typography.mode === "split" && typography.heading && (
        <FontPickerField
          label="Heading font"
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
        <legend className={styles.legend}>Weights</legend>
        <p className={styles.hint}>
          Only the weights you pick here are downloaded. Some fonts don't ship every weight —
          check fonts.google.com if a weight looks wrong after saving.
        </p>
        {(
          [
            ["body", "Body"],
            ["bodyBold", "Body bold"],
            ["h1", "H1"],
            ["h2", "H2"],
            ["h3", "H3"],
            ["h4", "H4"],
            ["h5", "H5"],
            ["h6", "H6"],
          ] as const
        ).map(([key, label]) => (
          <div className={styles.fieldRow} key={key}>
            <label className={styles.labelInline} htmlFor={`stagecraft-weight-${key}`}>
              {label}
            </label>
            <select
              id={`stagecraft-weight-${key}`}
              className={styles.select}
              value={typography.weights[key]}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  typography: {
                    ...prev.typography,
                    weights: {
                      ...prev.typography.weights,
                      [key]: Number(e.target.value),
                    },
                  },
                }))
              }
            >
              {FONT_WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        ))}
      </fieldset>
    </>
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
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <select
        className={styles.select}
        value={value.category}
        onChange={(e) => handleCategoryChange(e.target.value as FontCategory)}
      >
        {FONT_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {categoryLabel(cat)}
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
        />
      ) : (
        <select
          className={styles.select}
          value={value.family}
          onChange={(e) => onChange({ category: value.category, family: e.target.value })}
        >
          {GOOGLE_FONTS[value.category as GoogleFontCategory].map((f) => (
            <option key={f.family} value={f.family}>
              {f.family}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function categoryLabel(cat: FontCategory): string {
  switch (cat) {
    case "sans-serif":
      return "Sans-serif";
    case "serif":
      return "Serif";
    case "monospace":
      return "Monospace";
    case "display":
      return "Display";
    case "handwriting":
      return "Handwriting";
    case "custom":
      return "Custom (any Google Font)";
  }
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
