import { createWorker } from "@stagecraft/queue";
import { handleCreateSite } from "./create-site";
import { handleMigrateSite } from "./migrate-site";

let workerInstance: ReturnType<typeof createWorker> | null = null;

export function getWorker() {
  if (!workerInstance) {
    workerInstance = createWorker({
      handlers: {
        create_site: handleCreateSite,
        migrate_site: handleMigrateSite,
      },
      pollIntervalMs: 3000,
    });
  }
  return workerInstance;
}
