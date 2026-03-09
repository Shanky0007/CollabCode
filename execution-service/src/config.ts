export const config = {
  judge0: {
    baseUrl: process.env.JUDGE0_URL || "http://localhost:2358",
    token: process.env.JUDGE0_TOKEN || "",          // for self-hosted auth
    rapidApiKey: process.env.JUDGE0_RAPIDAPI_KEY || "",  // for RapidAPI hosted
  },
  redis: {
    url: process.env.UPSTASH_REDIS_URL || "redis://localhost:6379",
    token: process.env.UPSTASH_REDIS_TOKEN || "",
  },
  queue: {
    name: "code-execution",
    concurrency: 10,
  },
};
