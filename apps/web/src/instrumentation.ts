export async function register() {
  // Start the job worker on the server side only
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getWorker } = await import("@/lib/jobs/worker");
    getWorker().start();
  }
}
