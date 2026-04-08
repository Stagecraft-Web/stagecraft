"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setError("");
    setCreating(true);
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
        setCreating(false);
        return;
      }

      // Redirect to site detail page to watch progress
      router.push(`/sites/${data.site.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("details");
      setCreating(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Create a new site</h1>
      <p><a href="/dashboard">&larr; Dashboard</a></p>

      {error && (
        <div style={{ padding: 12, background: "#f8d7da", borderRadius: 4, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {step === "blueprint" && (
        <section>
          <h2>Choose a blueprint</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {BLUEPRINTS.map((bp) => (
              <button
                key={bp.value}
                onClick={() => {
                  setBlueprintType(bp.value);
                  setStep("details");
                }}
                style={{
                  padding: 16,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  background: blueprintType === bp.value ? "#e8f0fe" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <strong>{bp.label}</strong>
                <br />
                <span style={{ color: "#666", fontSize: 14 }}>{bp.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "details" && (
        <section>
          <h2>Site details</h2>
          <p style={{ color: "#666", fontSize: 14 }}>
            Blueprint: <strong>{BLUEPRINTS.find((b) => b.value === blueprintType)?.label}</strong>
            {" "}
            <button
              onClick={() => setStep("blueprint")}
              style={{ background: "none", border: "none", color: "#0066cc", cursor: "pointer", fontSize: 14 }}
            >
              Change
            </button>
          </p>

          <div style={{ marginTop: 16 }}>
            <label htmlFor="site-name" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
              Artist / Site name
            </label>
            <input
              id="site-name"
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="e.g. Sarah Chen Music"
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 16,
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={!siteName.trim() || creating}
            style={{
              marginTop: 20,
              padding: "10px 24px",
              background: siteName.trim() ? "#0066cc" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 16,
              cursor: siteName.trim() ? "pointer" : "not-allowed",
            }}
          >
            Create site
          </button>
        </section>
      )}

      {step === "creating" && (
        <section style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 18 }}>Creating your site...</p>
          <p style={{ color: "#666" }}>Setting up GitHub repo, pushing template, and configuring Netlify.</p>
        </section>
      )}
    </main>
  );
}
