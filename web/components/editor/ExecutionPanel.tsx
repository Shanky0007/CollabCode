"use client";

import { useEffect, useRef, useState } from "react";

interface ExecutionResult {
  id: string;
  status: string;
  stdout: string | null;
  stderr: string | null;
  execution_time: number | null;
  memory_used: number | null;
  language: string;
}

const TERMINAL_STATUSES = [
  "accepted", "wrong_answer", "time_limit_exceeded",
  "compilation_error", "runtime_error", "error",
  "internal_error", "exec_format_error",
];

const STATUS_COLORS: Record<string, string> = {
  accepted: "text-green-400",
  wrong_answer: "text-yellow-400",
  time_limit_exceeded: "text-orange-400",
  compilation_error: "text-red-400",
  runtime_error: "text-red-400",
  error: "text-red-400",
  internal_error: "text-red-400",
  queued: "text-zinc-400",
  processing: "text-blue-400",
};

export default function ExecutionPanel({ jobId }: { jobId: string | null }) {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    setResult(null);
    setPolling(true);

    // Poll every 1.5 seconds until we get a terminal status
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/execute/${jobId}`);
        if (!res.ok) return;
        const data: ExecutionResult = await res.json();
        setResult(data);

        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(pollRef.current!);
          setPolling(false);
        }
      } catch {
        // Network error — keep polling
      }
    }, 1500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      setPolling(false);
    };
  }, [jobId]);

  if (!jobId && !result) {
    return (
      <div className="h-full bg-zinc-900 flex items-center justify-center">
        <p className="text-zinc-600 text-sm font-mono">
          Press ▶ Run to execute code
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-900 flex flex-col font-mono text-sm overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-zinc-500 text-xs uppercase tracking-wider">Output</span>
        {result && (
          <span className={`text-xs font-semibold ${STATUS_COLORS[result.status] ?? "text-zinc-400"}`}>
            {result.status.replace(/_/g, " ").toUpperCase()}
          </span>
        )}
        {polling && (
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            Running…
          </span>
        )}
        {result?.execution_time != null && (
          <span className="ml-auto text-xs text-zinc-600">
            {result.execution_time}s · {result.memory_used ?? "—"} KB
          </span>
        )}
      </div>

      {/* Output content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 text-zinc-300 whitespace-pre-wrap break-words">
        {!result && polling && (
          <span className="text-zinc-500">Waiting for result…</span>
        )}
        {result?.stdout && <span className="text-green-300">{result.stdout}</span>}
        {result?.stderr && (
          <span className="text-red-400">
            {result.stderr}
          </span>
        )}
        {result && !result.stdout && !result.stderr && (
          <span className="text-zinc-500">No output.</span>
        )}
      </div>
    </div>
  );
}
