"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Input from "@/components/Input";

const BLUEPRINTS = [
  { value: "solo-artist", label: "Solo Artist", description: "For solo musicians, singer-songwriters, and solo performers" },
  { value: "band", label: "Band / Ensemble", description: "For bands, ensembles, and musical groups" },
  { value: "composer-educator", label: "Composer / Educator", description: "For composers, music teachers, and academics" },
  { value: "epk-focused", label: "EPK / Press Kit", description: "Emphasis on press materials, bio, and booking info" },
  { value: "tour-focused", label: "Tour Focused", description: "Emphasis on tour dates, venues, and live performance" },
];

type Step = "blueprint" | "details" | "creating";

export default function CreateSitePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("blueprint");
  const [blueprintType, setBlueprintType] = useState("");
  const [siteName, setSiteName] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    setError("");
    setIsCreating(true);
    setStep("creating");

    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: siteName, blueprintType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create site");
        setStep("details");
        setIsCreating(false);
        return;
      }

      // Redirect to site detail page to watch progress
      router.push(`/sites/${data.site.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("details");
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

      {step === "blueprint" && (
        <section>
          <h2>Choose a blueprint</h2>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {BLUEPRINTS.map((bp) => (
              <Button
                key={bp.value}
                variant="card"
                isSelected={blueprintType === bp.value}
                onClick={() => {
                  setBlueprintType(bp.value);
                  setStep("details");
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

      {step === "details" && (
        <section>
          <h2>Site details</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            Blueprint: <strong>{BLUEPRINTS.find((b) => b.value === blueprintType)?.label}</strong>
            {" "}
            <Button variant="ghost" onClick={() => setStep("blueprint")}>
              Change
            </Button>
          </p>

          <div style={{ marginTop: "1rem" }}>
            <Input
              id="site-name"
              label="Artist / Site name"
              value={siteName}
              onChange={setSiteName}
              placeholder="e.g. Sarah Chen Music"
            />
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <Button onClick={handleCreate} isDisabled={!siteName.trim() || isCreating}>
              Create site
            </Button>
          </div>
        </section>
      )}

      {step === "creating" && (
        <section style={{ textAlign: "center", padding: "2.5rem" }}>
          <p style={{ fontSize: "var(--font-size-lg)" }}>Creating your site...</p>
          <p style={{ color: "var(--color-text-muted)" }}>Setting up GitHub repo, pushing template, and configuring Netlify.</p>
        </section>
      )}
    </main>
  );
}
