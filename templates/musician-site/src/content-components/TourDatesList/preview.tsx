import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
  previewTextMuted,
  previewAccent,
} from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";

interface MockDate {
  weekday: string;
  monthDay: string;
  year: string;
  venue: string;
  city: string;
  cta: "tickets" | "sold-out";
}

const mockDates: ReadonlyArray<MockDate> = [
  { weekday: "Fri", monthDay: "May 15", year: "2026", venue: "The Blue Note", city: "New York, NY", cta: "tickets" },
  { weekday: "Mon", monthDay: "Jun 1", year: "2026", venue: "The Fillmore", city: "San Francisco, CA", cta: "sold-out" },
  { weekday: "Sat", monthDay: "Jun 20", year: "2026", venue: "9:30 Club", city: "Washington, DC", cta: "tickets" },
];

export function TourDatesListPreview(): ReactNode {
  return (
    <StockPreviewFrame label="Tour Dates">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {mockDates.map((tourDate) => (
          <div
            key={`${tourDate.monthDay}-${tourDate.venue}`}
            style={{
              display: "grid",
              gridTemplateColumns: "4.5rem 1fr auto",
              gap: "0.75rem",
              alignItems: "center",
              padding: "0.625rem 0.75rem",
              border: previewBorder,
              background: previewBg,
              borderRadius: previewRadius,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontSize: "0.625rem", color: previewTextMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {tourDate.weekday}
              </span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: previewText }}>
                {tourDate.monthDay}
              </span>
              <span style={{ fontSize: "0.625rem", color: previewTextMuted }}>
                {tourDate.year}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: previewText,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {tourDate.venue}
              </div>
              <div style={{ fontSize: "0.6875rem", color: previewTextMuted }}>
                {tourDate.city}
              </div>
            </div>
            {tourDate.cta === "tickets" ? (
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "0.25rem 0.5rem",
                  background: previewAccent,
                  color: "#ffffff",
                  borderRadius: "4px",
                }}
              >
                Tickets
              </span>
            ) : (
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "0.25rem 0.5rem",
                  border: `1px solid ${previewAccent}`,
                  color: previewAccent,
                  borderRadius: "4px",
                }}
              >
                Sold Out
              </span>
            )}
          </div>
        ))}
      </div>
      <CaptionNote>Populated from your Tour Dates collection at render time.</CaptionNote>
    </StockPreviewFrame>
  );
}
