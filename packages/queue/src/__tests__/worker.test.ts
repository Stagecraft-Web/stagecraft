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

const { createWorker } = await import("../worker.js");

function makeJob(overrides = {}) {
  return {
    id: "job-1",
    type: "create_site",
    status: "queued",
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
      }),
    });
  });

  it("marks job as failed when handler returns success: false", async () => {
    const job = makeJob();
    mockFindFirst.mockResolvedValueOnce(job);
    mockUpdate.mockResolvedValue({});

    const handler = vi.fn().mockResolvedValue({ success: false, message: "Repo not found" });
    const worker = createWorker({ handlers: { create_site: handler } });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    worker.stop();

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "Repo not found",
      }),
    });
  });

  it("marks job as failed when handler throws", async () => {
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
      }),
    });
  });

  it("fails job with no registered handler", async () => {
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
