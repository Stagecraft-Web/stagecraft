"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import FormGroup from "@/components/FormGroup";

const BLUEPRINTS = [
  { value: "solo-artist", label: "Solo Artist", description: "For solo musicians, singer-songwriters, and solo performers" },
  { value: "band", label: "Band / Ensemble", description: "For bands, ensembles, and musical groups" },
  { value: "composer-educator", label: "Composer / Educator", description: "For composers, music teachers, and academics" },
  { value: "epk-focused", label: "EPK / Press Kit", description: "Emphasis on press materials, bio, and booking info" },
  { value: "tour-focused", label: "Tour Focused", description: "Emphasis on tour dates, venues, and live performance" },
];

type Step = "url" | "blueprint" | "name" | "migrating";

export default function MigrateSitePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [blueprintType, setBlueprintType] = useState("");
  const [artistName, setArtistName] = useState("");
  const [error, setError] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);

  function handleUrlNext() {
    setError("");
    try {
      const parsed = new URL(sourceUrl.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("URL must start with http:// or https://");
        return;
      }
    } catch {
      setError("Please enter a valid URL, e.g. https://www.sarahchenmusic.com");
      return;
    }
    setStep("blueprint");
  }

  async function handleMigrate() {
    setError("");
    setIsMigrating(true);
    setStep("migrating");

    try {
      const res = await fetch("/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: sourceUrl.trim(),
          name: artistName.trim(),
          blueprintType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to start migration");
        setStep("name");
        setIsMigrating(false);
        return;
      }

      router.push(`/sites/${data.site.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("name");
      setIsMigrating(false);
    }
  }

  return (
    <main style={{ maxWidth: "var(--max-width-narrow)", margin: "2.5rem auto", fontFamily: "var(--font-body)" }}>
      <h1>Migrate an existing site</h1>
      <p><a href="/dashboard">&larr; Dashboard</a></p>

      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", marginBottom: "1.5rem" }}>
        Enter your current website URL and we&rsquo;ll extract the content, map it into a new Stagecraft site,
        and give you a reviewable preview.
      </p>

      {error && (
        <div style={{ padding: "0.75rem", background: "var(--color-error-bg)", borderRadius: "var(--radius-sm)", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Step 1: Source URL */}
      {step === "url" && (
        <section>
          <h2>Step 1 of 3 — Current website</h2>
          <FormGroup
            id="source-url"
            label="Your existing website URL"
            value={sourceUrl}
            onChange={setSourceUrl}
            placeholder="https://www.yoursite.com"
          />
          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-faint)", margin: "0.375rem 0 1rem" }}>
            Works best with simple brochure-style sites (Squarespace, Wix, custom HTML, etc.).
          </p>
          <Button onClick={handleUrlNext} isDisabled={!sourceUrl.trim()}>
            Next &rarr;
          </Button>
        </section>
      )}

      {/* Step 2: Blueprint */}
      {step === "blueprint" && (
        <section>
          <h2>Step 2 of 3 — Choose a blueprint</h2>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: 0 }}>
            Migrating: <code style={{ fontSize: "var(--font-size-xs)" }}>{sourceUrl}</code>{" "}
            <Button variant="ghost" size="sm" onClick={() => setStep("url")}>Change</Button>
          </p>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {BLUEPRINTS.map((bp) => (
              <Button
                key={bp.value}
                variant="card"
                isSelected={blueprintType === bp.value}
                onClick={() => {
                  setBlueprintType(bp.value);
                  setStep("name");
                }}
              >
                <strong>{bp.label}</strong>
                <br />
                <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>{bp.description}</span>
              </Button>
            ))}
          </div>
        </section>
      )}

      {/* Step 3: Artist name */}
      {step === "name" && (
        <section>
          <h2>Step 3 of 3 — Artist name</h2>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: 0 }}>
            Blueprint: <strong>{BLUEPRINTS.find((b) => b.value === blueprintType)?.label}</strong>{" "}
            <Button variant="ghost" size="sm" onClick={() => setStep("blueprint")}>Change</Button>
          </p>
          <div style={{ marginTop: "0.75rem" }}>
            <FormGroup
              id="artist-name"
              label="Artist / site name"
              value={artistName}
              onChange={setArtistName}
              placeholder="e.g. Sarah Chen Music"
            />
          </div>
          <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
            <Button
              onClick={handleMigrate}
              isDisabled={!artistName.trim() || isMigrating}
            >
              Start migration
            </Button>
            <Button variant="ghost" onClick={() => setStep("blueprint")} isDisabled={isMigrating}>
              &larr; Back
            </Button>
          </div>
        </section>
      )}

      {/* Migrating state */}
      {step === "migrating" && (
        <section style={{ textAlign: "center", padding: "2.5rem" }}>
          <p style={{ fontSize: "var(--font-size-lg)" }}>Migrating your site&hellip;</p>
          <p style={{ color: "var(--color-text-muted)" }}>
            Crawling <code style={{ fontSize: "var(--font-size-sm)" }}>{sourceUrl}</code>, mapping content, and setting up your new site.
          </p>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-faint)" }}>
            This may take a minute. You&rsquo;ll be redirected when it&rsquo;s ready.
          </p>
        </section>
      )}
    </main>
  );
}
