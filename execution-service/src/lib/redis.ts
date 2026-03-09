import { Redis } from "ioredis";
import { config } from "../config";

// Single shared Redis connection used by both BullMQ and rate limiting
export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  tls: config.redis.url.startsWith("rediss://") ? {} : undefined,
});

redis.on("error", (err) => console.error("[Redis] connection error:", err));
redis.on("connect", () => console.log("[Redis] connected"));
