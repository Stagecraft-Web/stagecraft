"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TextField } from "@/components/admin/form";
import {
  PAGE_SLUG_PATTERN,
  slugifyTitle,
  type PageSummary,
} from "@/lib/site-config-types";

type Props = {
  initialPages: PageSummary[];
};

/**
 * Client island for the Pages panel:
 *   - lists every page (each row links to /admin/pages/<slug>)
 *   - has an inline "Add page" form with auto-slug suggestion
 *   - confirms before delete; refreshes the route on success
 *
 * We re-fetch via `router.refresh()` rather than mutating local state so the
 * server component owns the canonical list — splash-page-first sort, missing
 * pages, etc. stay consistent without duplicating the logic here.
 */
export function PagesPanel({ initialPages }: Props) {
  const router = useRouter();

  const [pages, setPages] = useState(initialPages);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  // The slug auto-populates from the title until the user types a slug
  // explicitly, at which point we stop auto-syncing.
  const [hasSlugBeenEdited, setHasSlugBeenEdited] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const effectiveSlug = hasSlugBeenEdited ? newSlug : slugifyTitle(newTitle);
  const isSlugValid = effectiveSlug.length > 0 && PAGE_SLUG_PATTERN.test(effectiveSlug);
  const isTitleValid = newTitle.trim().length > 0;
  const canCreate = isSlugValid && isTitleValid && !isCreating;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!canCreate) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: effectiveSlug, title: newTitle.trim() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true; slug: string }
        | { ok: false; error: string }
        | null;
      if (!res.ok || !body || !body.ok) {
        const message =
          (body && "error" in body && body.error) || `Create failed (HTTP ${res.status})`;
        setCreateError(message);
        return;
      }
      // Reset form and update the list optimistically; router.refresh() pulls
      // the canonical sorted view from the server too.
      setPages((current) => [
        ...current,
        { slug: body.slug, title: newTitle.trim(), isSplashPage: false },
      ]);
      setNewTitle("");
      setNewSlug("");
      setHasSlugBeenEdited(false);
      router.refresh();
      router.push(`/admin/pages/${body.slug}`);
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "Create failed");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!window.confirm(`Delete page "${slug}"? This cannot be undone.`)) return;
    setDeletingSlug(slug);
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(body?.error ?? `Delete failed (HTTP ${res.status})`);
        return;
      }
      setPages((current) => current.filter((p) => p.slug !== slug));
      router.refresh();
    } finally {
      setDeletingSlug(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <section
        aria-label="Page list"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        {pages.length === 0 ? (
          <p
            style={{
              padding: "var(--space-6)",
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            No pages yet — add one below to get started.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {pages.map((page, idx) => (
              <li
                key={page.slug}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  borderTop: idx === 0 ? "none" : "1px solid var(--color-border)",
                }}
              >
                <Link
                  href={`/admin/pages/${page.slug}`}
                  style={{
                    flex: 1,
                    color: "var(--color-text)",
                    textDecoration: "none",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-base)",
                      fontWeight: "var(--font-weight-semibold)" as unknown as number,
                    }}
                  >
                    {page.title}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {page.isSplashPage ? "/" : `/${page.slug}`}
                  </span>
                </Link>
                {page.isSplashPage ? (
                  <span
                    title="Splash page — takes over /"
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--color-text-emphasis)",
                      padding: "var(--space-1) var(--space-2)",
                      background: "var(--color-surface-raised)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    Splash
                  </span>
                ) : null}
                <Link
                  href={`/admin/pages/${page.slug}`}
                  style={{
                    padding: "var(--space-1) var(--space-3)",
                    fontSize: "var(--font-size-sm)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text)",
                    cursor: "pointer",
                    borderRadius: "var(--radius-sm)",
                    textDecoration: "none",
                  }}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(page.slug)}
                  disabled={deletingSlug === page.slug}
                  aria-label={`Delete page ${page.slug}`}
                  style={{
                    padding: "var(--space-1) var(--space-3)",
                    fontSize: "var(--font-size-sm)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-error)",
                    cursor: deletingSlug === page.slug ? "wait" : "pointer",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {deletingSlug === page.slug ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Add a page"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          padding: "var(--space-6)",
        }}
      >
        <h2
          style={{
            fontSize: "var(--font-size-lg)",
            fontWeight: "var(--font-weight-semibold)" as unknown as number,
            margin: "0 0 var(--space-4) 0",
          }}
        >
          Add a page
        </h2>
        <form onSubmit={handleCreate}>
          <TextField
            id="new-page-title"
            label="Title"
            description="Shown on the page itself and in the browser tab."
            value={newTitle}
            onChange={setNewTitle}
            placeholder="e.g. Tour 2026"
            isRequired
          />
          <TextField
            id="new-page-slug"
            label="URL slug"
            description={
              <>
                Lowercase letters, digits, and hyphens. Becomes the URL (
                <code style={{ fontFamily: "var(--font-mono)" }}>/{effectiveSlug || "your-slug"}</code>).
                {hasSlugBeenEdited ? null : " Suggested from the title — edit to override."}
              </>
            }
            value={effectiveSlug}
            onChange={(v) => {
              setHasSlugBeenEdited(true);
              setNewSlug(v);
            }}
            placeholder="tour-2026"
            isRequired
          />
          {createError ? (
            <div
              role="alert"
              style={{
                color: "var(--color-text-error)",
                fontSize: "var(--font-size-sm)",
                marginBottom: "var(--space-4)",
              }}
            >
              {createError}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={!canCreate}
            style={{
              padding: "var(--space-2) var(--space-4)",
              fontSize: "var(--font-size-sm)",
              fontWeight: "var(--font-weight-semibold)" as unknown as number,
              border: "1px solid transparent",
              background: canCreate ? "var(--color-action)" : "var(--color-action-disabled)",
              color: "var(--color-action-fg)",
              cursor: canCreate ? "pointer" : "not-allowed",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {isCreating ? "Creating…" : "Add page"}
          </button>
        </form>
      </section>
    </div>
  );
}
