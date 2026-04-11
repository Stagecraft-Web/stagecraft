import { prisma } from "@stagecraft/db";
import { MAX_REPAIR_ATTEMPTS } from "./repair.js";
import type { JobHandler, JobResult } from "./types.js";

interface WorkerOptions {
  handlers: Record<string, JobHandler>;
  pollIntervalMs?: number;
}

export function createWorker(options: WorkerOptions) {
  const { handlers, pollIntervalMs = 5000 } = options;
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
        running = false;
        return;
      }

      // Mark as running
      await prisma.siteJob.update({
        where: { id: job.id },
        data: { status: "running", startedAt: new Date() },
      });

      let result: JobResult;
      try {
        result = await handler({ job });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await prisma.siteJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            errorMessage: message,
            failureCategory: "unknown",
            completedAt: new Date(),
          },
        });
        running = false;
        return;
      }

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
      }
    } catch (error) {
      console.error("[worker] Poll error:", error);
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (timer) return;
      console.log(`[worker] Starting with ${pollIntervalMs}ms poll interval`);
      timer = setInterval(poll, pollIntervalMs);
      // Run immediately on start
      poll();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        console.log("[worker] Stopped");
      }
    },
  };
}
