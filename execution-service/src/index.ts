import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { executeRoute } from "./routes/execute";
import { startWorker } from "./queue/worker";

const server = Fastify({ logger: true });

async function bootstrap() {
  // CORS — allow requests from the Next.js frontend.
  // FRONTEND_URL may be a comma-separated list (e.g. prod + Vercel preview URLs).
  const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  await server.register(cors, {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    methods: ["GET", "POST"],
  });

  // Global rate limit: 60 req/min per IP (in-memory; swap for Redis store in prod)
  await server.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
  });

  // Routes
  await server.register(executeRoute, { prefix: "/api" });

  // Health check
  server.get("/health", async () => ({ status: "ok" }));

  // Start BullMQ worker
  startWorker();

  const port = Number(process.env.PORT) || 4000;
  await server.listen({ port, host: "0.0.0.0" });
  console.log(`Execution service running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
