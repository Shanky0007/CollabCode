import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role — bypasses RLS for internal writes
);

interface ExecutionUpdate {
  status?: string;
  stdout?: string | null;
  stderr?: string | null;
  execution_time?: number | null;
  memory_used?: number | null;
}

/**
 * Updates an execution row in Supabase after job processing.
 */
export async function updateExecutionResult(jobId: string, update: ExecutionUpdate) {
  const { error } = await supabase
    .from("executions")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    console.error(`[Supabase] Failed to update execution ${jobId}:`, error.message);
  }
}
