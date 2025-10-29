import { QueueManager } from "../../shared/queueManager";
import { Queue } from "bullmq";

export type DemoJobData = {
  message?: string;
};

let demoQueue: Queue<DemoJobData> | undefined;

/**
 * Demo Queue Setup
 *
 * Registers a single demo queue and worker. The worker simply logs that it's set up
 * and returns a small result so you can verify the queue/worker pipeline is working.
 */
export async function setupQueues(queueManager: QueueManager): Promise<void> {
  if (!queueManager.isQueueReady()) {
    console.log("⚠️ Queue system not ready - demo queue will not be initialized");
    return;
  }

  try {
    demoQueue = queueManager.registerQueue<DemoJobData>("demo-queue", {
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 1,
      },
    });

    // Register a simple demo worker that just prints a message when processing a job.
    queueManager.registerWorker<DemoJobData>(
      "demo-queue",
      async (job) => {
        console.log("✅ Demo worker setup done", job?.data ?? {});
        return { ok: true, processedAt: new Date().toISOString() };
      },
      {
        concurrency: 1,
        onCompleted: (job, result) => {
          console.log(`✅ [Demo] Job ${job.id} completed:`, result);
        },
        onFailed: (job, error) => {
          console.error(`❌ [Demo] Job ${job?.id} failed:`, error?.message ?? error);
        },
        onError: (error) => {
          console.error("❌ [Demo] Worker error:", error);
        },
      }
    );

    const queueEvents = queueManager.registerQueueEvents("demo-queue");
    queueEvents.on("completed", ({ jobId }) => {
      console.log(`✅ [Demo] Event: job ${jobId} completed`);
    });
    queueEvents.on("failed", ({ jobId, failedReason }) => {
      console.error(`❌ [Demo] Event: job ${jobId} failed:`, failedReason);
    });

    console.log("✅ Demo queue and worker initialized");
  } catch (error) {
    console.error("❌ Failed to setup demo queue:", error);
  }
}

/**
 * Add a demo job to the queue (or run directly if queue not initialized)
 */
export async function addDemoJob(data: DemoJobData = {}, opts?: { delay?: number }) {
  if (!demoQueue) {
    console.warn("⚠️ Demo queue not initialized - processing directly");
    // simulate job processing directly
    console.log("✅ Demo worker setup done", data);
    return;
  }

  await demoQueue.add("demo-job", data, {
    delay: opts?.delay,
    attempts: 1,
  });
}

export { demoQueue };