import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { executionQueue } from "../queue/executionQueue";

interface ExecuteBody {
  jobId: string;
  roomId: string;
  language: string;    // plain name: "python", "javascript", "cpp"
  version?: string;
  source_code: string;
  stdin?: string;
}

export async function executeRoute(fastify: FastifyInstance) {
  /**
   * POST /api/execute
   * Called by Next.js API route — creates a Supabase execution row first,
   * then enqueues the job here. Returns immediately with jobId.
   */
  fastify.post(
    "/execute",
    {
      schema: {
        body: {
          type: "object",
          required: ["jobId", "roomId", "language", "source_code"],
          properties: {
            jobId: { type: "string" },
            roomId: { type: "string" },
            language: { type: "string" },
            version: { type: "string" },
            source_code: { type: "string" },
            stdin: { type: "string" },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: ExecuteBody }>, reply: FastifyReply) => {
      const { jobId, roomId, language, version, source_code, stdin } = req.body;

      const job = await executionQueue.add(
        "execute" as never,
        { jobId, roomId, language, version, source_code, stdin },
        { jobId } // use jobId as BullMQ job ID for deduplication
      );

      return reply.status(202).send({
        queued: true,
        jobId,
        bullJobId: job.id,
      });
    }
  );

  /**
   * GET /api/execute/:jobId/status
   * Quick status check — clients can poll this while waiting for results.
   */
  fastify.get(
    "/execute/:jobId/status",
    async (req: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
      const job = await executionQueue.getJob(req.params.jobId);

      if (!job) return reply.status(404).send({ error: "Job not found" });

      const state = await job.getState();
      return { jobId: req.params.jobId, state };
    }
  );
}
