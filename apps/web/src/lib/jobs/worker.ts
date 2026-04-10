import { createWorker } from "@stagecraft/queue";
import { handleCreateSite } from "./create-site";

let workerInstance: ReturnType<typeof createWorker> | null = null;

export function getWorker() {
  if (!workerInstance) {
    workerInstance = createWorker({
      handlers: {
        create_site: handleCreateSite,
      },
      pollIntervalMs: 3000,
    });
  }
  return workerInstance;
}
