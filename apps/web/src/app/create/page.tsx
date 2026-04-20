"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Input from "@/components/Input";

type Mode = "choose" | "scratch" | "recreate" | "creating";

export default function CreateSitePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [siteName, setSiteName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateFromScratch() {
    setError("");
    setIsCreating(true);
    setMode("creating");

    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: siteName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create site");
        setMode("scratch");
        setIsCreating(false);
        return;
      }

      router.push(`/sites/${data.site.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setMode("scratch");
      setIsCreating(false);
    }
  }

  async function handleRecreate() {
    setError("");

    try {
      new URL(sourceUrl.trim());
    } catch {
      setError("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setIsCreating(true);
    setMode("creating");

    try {
      const res = await fetch("/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: sourceUrl.trim(),
          name: siteName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to start site creation");
        setMode("recreate");
        setIsCreating(false);
        return;
      }

      router.push(`/sites/${data.site.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setMode("recreate");
      setIsCreating(false);
    }
  }

  return (
    <main style={{ maxWidth: "var(--max-width-narrow)", margin: "2.5rem auto", fontFamily: "var(--font-body)" }}>
      <h1>Create a new site</h1>
      <p><a href="/dashboard">&larr; Dashboard</a></p>

      {error && (
        <div style={{ padding: "0.75rem", background: "var(--color-error-bg)", borderRadius: "var(--radius-sm)", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {mode === "choose" && (
        <section>
          <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
            How would you like to get started?
          </p>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <Button
              variant="card"
              onClick={() => setMode("scratch")}
            >
              <strong>Start from scratch</strong>
              <br />
              <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                Create a blank musician site with placeholder content you can customize.
              </span>
            </Button>
            <Button
              variant="card"
              onClick={() => setMode("recreate")}
            >
              <strong>Recreate from an existing site</strong>
              <br />
              <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                Enter a URL and we&rsquo;ll extract the content and build a new site from it.
              </span>
            </Button>
          </div>
        </section>
      )}

      {mode === "scratch" && (
        <section>
          <h2>Start from scratch</h2>
          <div style={{ marginTop: "0.75rem" }}>
            <Input
              id="site-name"
              label="Artist / Site name"
              value={siteName}
              onChange={setSiteName}
              placeholder="e.g. Sarah Chen Music"
            />
          </div>
          <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
            <Button onClick={handleCreateFromScratch} isDisabled={!siteName.trim() || isCreating}>
              Create site
            </Button>
            <Button variant="ghost" onClick={() => { setMode("choose"); setError(""); }}>
              &larr; Back
            </Button>
          </div>
        </section>
      )}

      {mode === "recreate" && (
        <section>
          <h2>Recreate from an existing site</h2>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: 0, marginBottom: "1rem" }}>
            We&rsquo;ll crawl the site, extract the content, and build a new Stagecraft site from it.
          </p>
          <div style={{ display: "grid", gap: "1rem" }}>
            <Input
              id="source-url"
              label="Existing website URL"
              value={sourceUrl}
              onChange={setSourceUrl}
              placeholder="https://www.yoursite.com"
            />
            <Input
              id="site-name-recreate"
              label="Artist / Site name"
              value={siteName}
              onChange={setSiteName}
              placeholder="e.g. Sarah Chen Music"
            />
          </div>
          <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
            <Button
              onClick={handleRecreate}
              isDisabled={!siteName.trim() || !sourceUrl.trim() || isCreating}
            >
              Create site
            </Button>
            <Button variant="ghost" onClick={() => { setMode("choose"); setError(""); }}>
              &larr; Back
            </Button>
          </div>
        </section>
      )}

      {mode === "creating" && (
        <section style={{ textAlign: "center", padding: "2.5rem" }}>
          <p style={{ fontSize: "var(--font-size-lg)" }}>Creating your site&hellip;</p>
          <p style={{ color: "var(--color-text-muted)" }}>
            Setting up GitHub repo, building your site, and configuring Netlify.
          </p>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-faint)" }}>
            This may take a minute. You&rsquo;ll be redirected when it&rsquo;s ready.
          </p>
        </section>
      )}
    </main>
  );
}
