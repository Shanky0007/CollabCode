import axios from "axios";
import { config } from "../config";

// Judge0 CE language IDs
// Full list: GET /languages on your Judge0 instance
export const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,   // Node.js 12.14.0
  typescript: 74,   // TypeScript 3.7.4
  python: 71,       // Python 3.8.1
  java: 62,         // Java OpenJDK 13.0.1
  cpp: 54,          // C++ (GCC 9.2.0)
  c: 50,            // C (GCC 9.2.0)
  go: 60,           // Go 1.13.5
  rust: 73,         // Rust 1.40.0
  ruby: 72,         // Ruby 2.7.0
  php: 68,          // PHP 7.4.1
};

export interface Judge0Result {
  status: string;
  stdout: string | null;
  stderr: string | null;
  exit_code: number;
  execution_time: number | null;
  memory_used: number | null;
}

export async function runWithJudge0(params: {
  language: string;
  source_code: string;
  stdin?: string;
}): Promise<Judge0Result> {
  const languageId = LANGUAGE_IDS[params.language];
  if (!languageId) {
    return {
      status: "error",
      stdout: null,
      stderr: `Language '${params.language}' is not supported.`,
      exit_code: 1,
      execution_time: null,
      memory_used: null,
    };
  }

  // RapidAPI hosted Judge0 uses different auth headers than self-hosted
  const isRapidApi = Boolean(config.judge0.rapidApiKey);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (isRapidApi) {
    headers["X-RapidAPI-Key"] = config.judge0.rapidApiKey;
    headers["X-RapidAPI-Host"] = "judge0-ce.p.rapidapi.com";
  } else if (config.judge0.token) {
    headers["X-Auth-Token"] = config.judge0.token;
  }

  const baseUrl = isRapidApi
    ? "https://judge0-ce.p.rapidapi.com"
    : config.judge0.baseUrl;

  const response = await axios.post(
    `${baseUrl}/submissions?base64_encoded=false&wait=true&fields=stdout,stderr,compile_output,status,time,memory`,
    {
      language_id: languageId,
      source_code: params.source_code,
      stdin: params.stdin ?? "",
    },
    { headers, timeout: 30_000, validateStatus: () => true }
  );

  if (response.status !== 200 && response.status !== 201) {
    const msg = response.data?.error ?? `Judge0 returned HTTP ${response.status}`;
    console.error(`[Judge0] Error for language '${params.language}': ${msg}`);
    return {
      status: "error",
      stdout: null,
      stderr: msg,
      exit_code: 1,
      execution_time: null,
      memory_used: null,
    };
  }

  const data = response.data;
  const statusId: number = data.status?.id ?? 0;
  const statusDesc: string = data.status?.description ?? "Unknown";

  // Judge0 status IDs: 3 = Accepted, 4 = Wrong Answer, 5 = TLE, 6 = CE, 7-12 = RE
  const statusMap: Record<number, string> = {
    3: "accepted",
    4: "wrong_answer",
    5: "time_limit_exceeded",
    6: "compilation_error",
    14: "exec_format_error",
  };
  const status = statusMap[statusId] ?? (statusId >= 7 ? "runtime_error" : "error");

  // compile_output is populated for compilation errors
  const stderr = data.stderr || data.compile_output || null;
  const stdout = data.stdout || null;

  console.log(`[Judge0] Job done — ${statusDesc} (id=${statusId})`);

  return {
    status,
    stdout,
    stderr,
    exit_code: statusId === 3 ? 0 : 1,
    execution_time: data.time ? parseFloat(data.time) : null,
    memory_used: data.memory ?? null,
  };
}
