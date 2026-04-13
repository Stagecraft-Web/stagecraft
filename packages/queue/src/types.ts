import type { SiteJob } from "@prisma/client";
import type { FailureCategory } from "@stagecraft/shared";

export interface JobContext {
  job: SiteJob;
}

export interface JobResult {
  success: boolean;
  message?: string;
  failureCategory?: FailureCategory;
  /** When true and repair attempts remain, worker will re-queue instead of failing */
  shouldRepair?: boolean;
  data?: Record<string, unknown>;
}

export type JobHandler = (ctx: JobContext) => Promise<JobResult>;
