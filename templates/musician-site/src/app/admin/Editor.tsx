"use client";

import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { useCallback } from "react";

import { puckConfig } from "@/puck/config";
import type { PageData } from "@/lib/content";

export function Editor({ initialData }: { initialData: PageData }) {
  const onPublish = useCallback(async (data: PageData) => {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "home", data }),
    });
    if (!res.ok) {
      throw new Error(`Save failed: ${res.status}`);
    }
  }, []);

  return <Puck config={puckConfig} data={initialData} onPublish={onPublish} />;
}
