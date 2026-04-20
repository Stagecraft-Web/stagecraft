import type { CSSProperties, ReactNode } from "react";
import {
  previewBorder,
  previewBorderStrong,
  previewBgMuted,
  previewRadius,
  previewText,
  previewTextMuted,
  labelStyle,
} from "../_shared/previewTokens";
import { extractIframe, extractEmbedHost } from "./extractIframe";
import type { EmbedAspectRatio } from "./schema";

type EmbedValue = {
  code: string;
  aspectRatio: EmbedAspectRatio;
  title: string;
};

/**
 * Keystatic admin preview for `embed`. Keystatic renders previews inside
 * its own admin shell which does NOT load the site's global.css — see
 * ../_shared/previewTokens.ts for why we use inline styles with hardcoded
 * neutral colors here.
 *
 * The preview's job is to give the editor a quick "is the right thing
 * wired up here" signal. We re-run the same parser the renderer uses so
 * any sanitization issue (missing src, no iframe at all) shows here too.
 */
export function EmbedPreview({ value }: { value: EmbedValue }): ReactNode {
  const { code, aspectRatio, title } = value;
  const parsed = extractIframe(code);

  if (!parsed) {
    return <InvalidEmbedCard hasInput={code.trim().length > 0} />;
  }

  const host = extractEmbedHost(parsed.attributes.src);
  const resolvedTitle = title.trim() || parsed.attributes.title?.trim() || "(no title)";

  return (
    <div
      style={{
        border: previewBorderStrong,
        borderRadius: previewRadius,
        background: previewBgMuted,
        padding: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={labelStyle}>Embed</span>
        {host && <HostBadge host={host} />}
      </div>

      <div style={detailRow}>
        <DetailLabel>Title</DetailLabel>
        <span style={{ color: previewText, fontSize: "0.8125rem" }}>{resolvedTitle}</span>
      </div>

      <div style={detailRow}>
        <DetailLabel>Aspect</DetailLabel>
        <span style={{ color: previewText, fontSize: "0.8125rem" }}>
          {aspectRatio === "auto" ? "Auto (iframe size)" : aspectRatio}
        </span>
      </div>

      <div style={detailRow}>
        <DetailLabel>Source</DetailLabel>
        <span
          style={{
            color: previewTextMuted,
            fontSize: "0.6875rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            wordBreak: "break-all",
          }}
        >
          {parsed.attributes.src}
        </span>
      </div>
    </div>
  );
}

const detailRow: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.125rem",
};

function DetailLabel({ children }: { children: ReactNode }): ReactNode {
  return <span style={{ ...labelStyle, fontSize: "0.625rem" }}>{children}</span>;
}

function HostBadge({ host }: { host: string }): ReactNode {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.125rem 0.5rem",
        background: "#ffffff",
        border: previewBorder,
        borderRadius: "999px",
        fontSize: "0.6875rem",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
        color: previewText,
      }}
    >
      {host}
    </span>
  );
}

function InvalidEmbedCard({ hasInput }: { hasInput: boolean }): ReactNode {
  return (
    <div
      style={{
        border: `1px dashed ${previewBorderStrong.replace("1px solid ", "")}`,
        borderRadius: previewRadius,
        background: previewBgMuted,
        padding: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={labelStyle}>Embed</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.125rem 0.5rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "999px",
            fontSize: "0.6875rem",
            color: "#b91c1c",
            fontWeight: 600,
          }}
        >
          {hasInput ? "Invalid embed code" : "Empty"}
        </span>
      </div>
      <span style={{ fontSize: "0.75rem", color: previewTextMuted }}>
        {hasInput
          ? "No <iframe src=\"…\"> found in the snippet. Paste the full embed HTML from the service."
          : "Paste an embed snippet from the service's Share / Embed UI."}
      </span>
    </div>
  );
}
