import { NextResponse } from "next/server";
import { prisma } from "@stagecraft/db";
import { getMetrics } from "@/lib/telemetry";

export async function GET() {
  let dbStatus: "ok" | "error" = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    // Database unreachable — report degraded but still respond
  }

  const { uptimeMs, counters } = getMetrics();
  const isHealthy = dbStatus === "ok";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      uptime: uptimeMs,
      checks: { database: dbStatus },
      metrics: counters,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
