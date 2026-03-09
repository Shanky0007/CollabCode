import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import axios from "axios";

const EXECUTION_SERVICE_URL = process.env.EXECUTION_SERVICE_URL || "http://localhost:4000";

// Supported languages — must match Judge0 language IDs in execution-service/src/services/judge0.ts
const SUPPORTED_LANGUAGES = new Set([
  "javascript", "typescript", "python", "java",
  "cpp", "c", "go", "rust", "ruby", "php",
]);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { roomId, language, source_code, stdin } = body;

  if (!roomId || !language || !source_code) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!SUPPORTED_LANGUAGES.has(language.toLowerCase())) {
    return NextResponse.json({ error: `Unsupported language: ${language}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Create execution row in Supabase with status "queued"
  const { data: execution, error } = await supabase
    .from("executions")
    .insert({
      room_id: roomId,
      triggered_by: userId,
      language,
      source_code,
      stdin: stdin ?? null,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !execution) {
    return NextResponse.json({ error: "Failed to create execution record" }, { status: 500 });
  }

  // 2. Enqueue in Fastify — Piston needs language name, no numeric ID
  await axios.post(`${EXECUTION_SERVICE_URL}/api/execute`, {
    jobId: execution.id,
    roomId,
    language: language.toLowerCase(),
    source_code,
    stdin: stdin ?? undefined,
  });

  return NextResponse.json({ jobId: execution.id, status: "queued" }, { status: 202 });
}
