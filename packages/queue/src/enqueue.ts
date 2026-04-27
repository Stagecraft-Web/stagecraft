import { prisma } from "@stagecraft/db";
import type { Prisma } from "@stagecraft/db";
import type { JobType } from "@stagecraft/shared";

interface EnqueueOptions {
  siteId: string;
  userId: string;
  type: JobType;
  payload?: Record<string, unknown>;
}

export async function enqueue(options: EnqueueOptions) {
  const job = await prisma.siteJob.create({
    data: {
      siteId: options.siteId,
      userId: options.userId,
      type: options.type,
      status: "queued",
      requestPayload: (options.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  return job;
}
