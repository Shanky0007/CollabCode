import { Queue } from "bullmq";
import { config } from "../config";

// BullMQ bundles its own ioredis — pass raw connection options to avoid type
// conflicts with the top-level ioredis used elsewhere in the service.
const connection = {
  url: config.redis.url,
  enableReadyCheck: false,
  maxRetriesPerRequest: null as null,
  tls: config.redis.url.startsWith("rediss://") ? {} : undefined,
};

export interface ExecutionJobData {
  jobId: string;        // our internal ID (= Supabase execution row id)
  roomId: string;
  language: string;     // e.g. "python", "javascript", "cpp"
  version?: string;     // optional pinned version, defaults to latest
  source_code: string;
  stdin?: string;
}

// The single queue that all execution requests are pushed into
export const executionQueue = new Queue<ExecutionJobData>(config.queue.name, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2_000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});
