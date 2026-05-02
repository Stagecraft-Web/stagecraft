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
          padding: "0.5rem 1rem",
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
          fontSize: "0.875rem",
        }}
      >
        <span>
          Signed in as <strong>{email || "(unknown)"}</strong>
        </span>
        <form action="/api/auth/logout" method="POST" style={{ margin: 0 }}>
          <button type="submit" style={{ padding: "0.25rem 0.75rem" }}>
            Sign out
          </button>
        </form>
      </div>
      <Puck config={puckConfig} data={initialData} onPublish={onPublish} />
    </div>
  );
}
