import type { SiteJob } from "@prisma/client";

export interface JobContext {
  job: SiteJob;
}

export interface JobResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export type JobHandler = (ctx: JobContext) => Promise<JobResult>;
