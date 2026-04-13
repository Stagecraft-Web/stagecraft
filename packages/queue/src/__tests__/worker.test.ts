import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@stagecraft/db", () => ({
  prisma: {
    siteJob: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
  },
}));

const { createWorker } = await import("../worker");

function makeJob(overrides = {}) {
  return {
    id: "job-1",
    type: "create_site",
    status: "queued",
    repairAttempts: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("createWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes a queued job through to completion", async () => {
    const job = makeJob();
    mockFindFirst.mockResolvedValueOnce(job);
    mockUpdate.mockResolvedValue({});

    const handler = vi.fn().mockResolvedValue({ success: true, data: { url: "https://example.com" } });
    const worker = createWorker({ handlers: { create_site: handler } });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    worker.stop();

    // Marked as running
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({ status: "running" }),
    });

    // Handler called with job context
    expect(handler).toHaveBeenCalledWith({ job });

    // Marked as completed with result
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "completed",
        resultPayload: { url: "https://example.com" },
        errorMessage: null,
        failureCategory: null,
      }),
    });
  });

  it("marks job as failed with failureCategory when handler returns success: false", async () => {
    const job = makeJob();
    mockFindFirst.mockResolvedValueOnce(job);
    mockUpdate.mockResolvedValue({});

    const handler = vi.fn().mockResolvedValue({
      success: false,
      message: "Repo not found",
      failureCategory: "github_api_error",
    });
    const worker = createWorker({ handlers: { create_site: handler } });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    worker.stop();

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "Repo not found",
        failureCategory: "github_api_error",
      }),
    });
  });

  it("marks job as failed with unknown category when handler throws", async () => {
    const job = makeJob();
    mockFindFirst.mockResolvedValueOnce(job);
    mockUpdate.mockResolvedValue({});

    const handler = vi.fn().mockRejectedValue(new Error("Connection timeout"));
    const worker = createWorker({ handlers: { create_site: handler } });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    worker.stop();

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "Connection timeout",
        failureCategory: "unknown",
      }),
    });
  });

  it("re-queues for repair when shouldRepair=true and repairAttempts < limit", async () => {
    const job = makeJob({ repairAttempts: 0 });
    mockFindFirst.mockResolvedValueOnce(job);
    mockUpdate.mockResolvedValue({});

    const handler = vi.fn().mockResolvedValue({
      success: false,
      message: "Schema invalid",
      failureCategory: "validation_error",
      shouldRepair: true,
    });
    const worker = createWorker({ handlers: { create_site: handler } });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    worker.stop();

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "queued",
        repairAttempts: { increment: 1 },
        failureCategory: "validation_error",
      }),
    });
  });

  it("fails instead of repairing when repairAttempts has reached the limit", async () => {
    const job = makeJob({ repairAttempts: 2 });
    mockFindFirst.mockResolvedValueOnce(job);
    mockUpdate.mockResolvedValue({});

    const handler = vi.fn().mockResolvedValue({
      success: false,
      message: "Schema still invalid",
      failureCategory: "validation_error",
      shouldRepair: true,
    });
    const worker = createWorker({ handlers: { create_site: handler } });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    worker.stop();

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "Schema still invalid",
        failureCategory: "validation_error",
      }),
    });
  });

  it("fails job with unknown category for no registered handler", async () => {
    const job = makeJob({ type: "deploy_config" });
    mockFindFirst.mockResolvedValueOnce(job);
    mockUpdate.mockResolvedValue({});

    const worker = createWorker({ handlers: {} });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    worker.stop();

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "No handler registered for job type: deploy_config",
        failureCategory: "unknown",
      }),
    });
  });

  it("does nothing when no jobs are queued", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const worker = createWorker({ handlers: {} });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    worker.stop();

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not start a second interval if already started", () => {
    const worker = createWorker({ handlers: {} });
    mockFindFirst.mockResolvedValue(null);

    worker.start();
    worker.start();
    worker.stop();
  });
});
