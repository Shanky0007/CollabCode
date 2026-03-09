import { Worker, Job } from "bullmq";
import { config } from "../config";

const connection = {
  url: config.redis.url,
  enableReadyCheck: false,
  maxRetriesPerRequest: null as null,
  tls: config.redis.url.startsWith("rediss://") ? {} : undefined,
};
import { runWithJudge0 } from "../services/judge0";
import { updateExecutionResult } from "../services/supabase";
import type { ExecutionJobData } from "./executionQueue";

export function startWorker() {
  const worker = new Worker<ExecutionJobData>(
    config.queue.name,
    async (job: Job<ExecutionJobData>) => {
      const { jobId, language, source_code, stdin } = job.data;

      console.log(`[Worker] Processing job ${jobId} — ${language}`);

      // Mark as processing in Supabase
      await updateExecutionResult(jobId, { status: "processing" });

      try {
        const result = await runWithJudge0({ language, source_code, stdin });

        await updateExecutionResult(jobId, {
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          execution_time: result.execution_time,
          memory_used: result.memory_used,
        });

        console.log(`[Worker] Job ${jobId} done — ${result.status}`);
      } catch (err) {
        await updateExecutionResult(jobId, { status: "error" });
        throw err;
      }
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: connection as any,
      concurrency: config.queue.concurrency,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed after all retries:`, err.message);
  });

  console.log("[Worker] BullMQ worker started");
  return worker;
}
