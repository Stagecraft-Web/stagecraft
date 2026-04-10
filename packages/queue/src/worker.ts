import { prisma } from "@stagecraft/db";
import { MAX_REPAIR_ATTEMPTS } from "./repair.js";
import type { JobHandler, JobResult } from "./types.js";

export type WorkerEventType =
  | "job.started"
  | "job.completed"
  | "job.failed"
  | "worker.started"
  | "worker.stopped";

export interface WorkerEvent {
  event: WorkerEventType;
  jobId?: string;
  jobType?: string;
  siteId?: string;
  durationMs?: number;
  error?: string;
}

interface WorkerOptions {
  handlers: Record<string, JobHandler>;
  pollIntervalMs?: number;
  /** Optional callback invoked after each structured event is logged. */
  onEvent?: (event: WorkerEvent) => void;
}

function emit(event: WorkerEvent, onEvent?: (e: WorkerEvent) => void): void {
  console.log(JSON.stringify({ ...event, ts: new Date().toISOString() }));
  onEvent?.(event);
}

export function createWorker(options: WorkerOptions) {
  const { handlers, pollIntervalMs = 5000, onEvent } = options;
  let running = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function poll() {
    if (running) return;
    running = true;

    try {
      // Fetch next queued job, ordered by creation time
      const job = await prisma.siteJob.findFirst({
        where: { status: "queued" },
        orderBy: { createdAt: "asc" },
      });

      if (!job) {
        running = false;
        return;
      }

      const handler = handlers[job.type];
      if (!handler) {
        await prisma.siteJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            errorMessage: `No handler registered for job type: ${job.type}`,
            failureCategory: "unknown",
            completedAt: new Date(),
          },
        });
        emit(
          { event: "job.failed", jobId: job.id, jobType: job.type, siteId: job.siteId, error: "No handler" },
          onEvent
        );
        running = false;
        return;
      }

      // Mark as running
      await prisma.siteJob.update({
        where: { id: job.id },
        data: { status: "running", startedAt: new Date() },
      });
      emit({ event: "job.started", jobId: job.id, jobType: job.type, siteId: job.siteId }, onEvent);

      const startMs = Date.now();
      let result: JobResult;
      try {
        result = await handler({ job });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const durationMs = Date.now() - startMs;
        await prisma.siteJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            errorMessage: message,
            failureCategory: "unknown",
            completedAt: new Date(),
          },
        });
        emit(
          { event: "job.failed", jobId: job.id, jobType: job.type, siteId: job.siteId, durationMs, error: message },
          onEvent
        );
        running = false;
        return;
      }

      const durationMs = Date.now() - startMs;

      if (result.success) {
        await prisma.siteJob.update({
          where: { id: job.id },
          data: {
            status: "completed",
            resultPayload: result.data ?? undefined,
            errorMessage: null,
            failureCategory: null,
            completedAt: new Date(),
          },
        });
        emit(
          { event: "job.completed", jobId: job.id, jobType: job.type, siteId: job.siteId, durationMs },
          onEvent
        );
      } else if (result.shouldRepair && job.repairAttempts < MAX_REPAIR_ATTEMPTS) {
        // Bounded repair: re-queue with incremented repair counter
        await prisma.siteJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            repairAttempts: { increment: 1 },
            errorMessage: result.message ?? null,
            failureCategory: result.failureCategory ?? null,
          },
        });
      } else {
        await prisma.siteJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            resultPayload: result.data ?? undefined,
            errorMessage: result.message ?? null,
            failureCategory: result.failureCategory ?? null,
            completedAt: new Date(),
          },
        });
        emit(
          { event: "job.failed", jobId: job.id, jobType: job.type, siteId: job.siteId, durationMs, error: result.message },
          onEvent
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({ event: "worker.poll_error", error: String(error), ts: new Date().toISOString() })
      );
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (timer) return;
      emit({ event: "worker.started" }, onEvent);
      timer = setInterval(poll, pollIntervalMs);
      // Run immediately on start
      poll();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        emit({ event: "worker.stopped" }, onEvent);
      }
    },
  };
}
