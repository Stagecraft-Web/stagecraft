"use client";

import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { useCallback } from "react";

import { puckConfig } from "@/puck/config";
import type { PageData } from "@/lib/content";

type Props = {
  initialData: PageData;
  pageSlug: string;
  email: string;
};

export function Editor({ initialData, pageSlug, email }: Props) {
  const onPublish = useCallback(
    async (data: PageData) => {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageSlug, data }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(`Publish failed: ${body?.error ?? res.status}`);
      }
    },
    [pageSlug],
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-2) var(--space-4)",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface-subtle)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        <span>
          Signed in as <strong>{email || "(unknown)"}</strong>
        </span>
        <form action="/api/auth/logout" method="POST" style={{ margin: 0 }}>
          <button type="submit" style={{ padding: "var(--space-1) var(--space-3)" }}>
            Sign out
          </button>
        </form>
      </div>
      <Puck config={puckConfig} data={initialData} onPublish={onPublish} />
    </div>
  );
}
