/**
 * Lightweight in-process telemetry.
 *
 * Emits structured JSON events to stdout and maintains in-memory counters
 * that the /api/health endpoint can read. No external service required.
 *
 * Usage:
 *   import { log } from "@/lib/telemetry";
 *   log("job.started", { jobId, jobType });
 */

const counters = new Map<string, number>();
const startedAt = Date.now();

export function log(event: string, data?: Record<string, unknown>): void {
  const entry = { event, ts: new Date().toISOString(), ...data };
  console.log(JSON.stringify(entry));
  counters.set(event, (counters.get(event) ?? 0) + 1);
}

export function getMetrics(): { uptimeMs: number; counters: Record<string, number> } {
  return {
    uptimeMs: Date.now() - startedAt,
    counters: Object.fromEntries(counters),
  };
}
