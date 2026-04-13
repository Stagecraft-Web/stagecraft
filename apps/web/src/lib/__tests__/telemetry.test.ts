import { describe, it, expect } from "vitest";
import { log, getMetrics } from "../telemetry";

describe("telemetry", () => {
  it("increments the counter for each log call", () => {
    const before = getMetrics().counters["test.event"] ?? 0;
    log("test.event", { detail: "x" });
    expect(getMetrics().counters["test.event"]).toBe(before + 1);
  });

  it("tracks multiple distinct events independently", () => {
    const beforeA = getMetrics().counters["event.a"] ?? 0;
    const beforeB = getMetrics().counters["event.b"] ?? 0;

    log("event.a");
    log("event.a");
    log("event.b");

    expect(getMetrics().counters["event.a"]).toBe(beforeA + 2);
    expect(getMetrics().counters["event.b"]).toBe(beforeB + 1);
  });

  it("reports uptime > 0", () => {
    expect(getMetrics().uptimeMs).toBeGreaterThan(0);
  });
});
